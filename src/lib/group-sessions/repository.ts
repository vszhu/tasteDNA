import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { storedVenueToPublicVenue } from "@/lib/cmu-dining/public-venues";
import { SupabaseCmuVenueRepository } from "@/lib/cmu-dining/repository";
import { SupabaseSharedMenuRepository } from "@/lib/menu/shared-repository";
import { tasteProfileSchema } from "@/lib/taste/persistence-schema";
import { medicationAccountSchema, MEDICATION_ACCOUNT_SELECT } from "@/lib/medications/account";
import { MEDICATION_RULES_VERSION } from "@/lib/medications/catalog";
import { medicationVersionFingerprint, medicationVersions } from "./medication-checks";
import type { GroupRecommendation, MealPreferenceState, Venue } from "@/types/group";
import { mealPreferenceStateSchema } from "./schemas";
import {
  GroupSessionError,
  type CreateGroupSessionInput,
  type GroupSessionComputationInput,
  type GroupSessionDetail,
  type GroupSessionRepository,
  type InvitationResponseAction,
  type RecommendationSnapshot,
  type SessionMemberSummary,
} from "./types";

const sessionRowSchema = z.object({
  id: z.string().uuid(),
  creator_id: z.string().uuid(),
  name: z.string().nullable(),
  scheduled_for: z.string().nullable(),
  status: z.enum(["planning", "decided", "closed"]),
  created_at: z.string(),
  updated_at: z.string(),
});

const memberRowSchema = z.object({
  session_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(["invited", "accepted", "declined"]),
  accepted_at: z.string().nullable(),
  declined_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const preferenceRowSchema = z.object({
  user_id: z.string().uuid(),
  state_version: z.number().int().positive(),
  preference_state: z.unknown(),
  updated_at: z.string(),
});

const resultRowSchema = z.object({
  id: z.string().uuid(),
  algorithm_version: z.string(),
  input_hash: z.string(),
  result_snapshot: z.unknown(),
  created_at: z.string(),
});

const userRowSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().nullable(),
});

type SessionRow = z.infer<typeof sessionRowSchema>;
type MemberRow = z.infer<typeof memberRowSchema>;
type PreferenceRow = z.infer<typeof preferenceRowSchema>;

const SESSION_SELECT =
  "id,creator_id,name,scheduled_for,status,created_at,updated_at";
const MEMBER_SELECT =
  "session_id,user_id,status,accepted_at,declined_at,created_at,updated_at";

function storageError(): GroupSessionError {
  return new GroupSessionError(
    "storage",
    "Group sessions are temporarily unavailable. Please try again.",
  );
}

function sharedSessionStatus(status: SessionRow["status"]) {
  if (status === "planning") return "open" as const;
  if (status === "decided") return "revealed" as const;
  return "cancelled" as const;
}

function cloneEmptyPreferences(): MealPreferenceState {
  return {
    desiredTags: [],
    avoidedTags: [],
    excludedIngredients: [],
    excludedProteinTypes: [],
  };
}

function checkedPreference(value: unknown): MealPreferenceState {
  const parsed = mealPreferenceStateSchema.safeParse(value);
  if (!parsed.success) throw storageError();
  return parsed.data;
}

function checkedRecommendation(value: unknown, sessionId: string): GroupRecommendation {
  if (
    !value ||
    typeof value !== "object" ||
    !("sessionId" in value) ||
    value.sessionId !== sessionId ||
    !("winner" in value) ||
    !("venueScores" in value) ||
    !("assignments" in value)
  ) {
    throw storageError();
  }
  return value as GroupRecommendation;
}

function memberSummary(
  row: MemberRow,
  displayName: string,
  preference: PreferenceRow | undefined,
): SessionMemberSummary {
  const hasMealPreferences = Boolean(preference);
  const status = row.status === "accepted"
    ? hasMealPreferences ? "responded" as const : "joined" as const
    : row.status;
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    displayName,
    status,
    hasMealPreferences,
    ...(preference ? { respondedAt: preference.updated_at } : {}),
  };
}

function resultSnapshot(
  row: z.infer<typeof resultRowSchema>,
  sessionId: string,
): RecommendationSnapshot {
  return {
    id: row.id,
    algorithmVersion: row.algorithm_version,
    inputHash: row.input_hash,
    recommendation: checkedRecommendation(row.result_snapshot, sessionId),
    computedAt: row.created_at,
  };
}

export class SupabaseGroupSessionRepository implements GroupSessionRepository {
  constructor(
    private readonly userClient: SupabaseClient,
    private readonly adminClient: SupabaseClient,
  ) {}

  private async sessionRowForUser(sessionId: string): Promise<SessionRow | null> {
    const { data, error } = await this.userClient
      .from("group_sessions")
      .select(SESSION_SELECT)
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw storageError();
    if (!data) return null;
    const parsed = sessionRowSchema.safeParse(data);
    if (!parsed.success) throw storageError();
    return parsed.data;
  }

  private async displayNames(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, string>();
    const { data, error } = await this.adminClient
      .from("users")
      .select("id,display_name")
      .in("id", [...new Set(userIds)]);
    if (error) throw storageError();
    const parsed = z.array(userRowSchema).safeParse(data ?? []);
    if (!parsed.success) throw storageError();
    return new Map(parsed.data.map((user) => [
      user.id,
      user.display_name?.trim() || "TasteDNA user",
    ]));
  }

  private async medicationMetadata(userIds: string[]) {
    if (!userIds.length) return [];
    const { data, error } = await this.adminClient.from("user_medication_profiles")
      .select("user_id,use_in_groups,revision").in("user_id", userIds);
    if (error) throw new GroupSessionError("storage", "Private medication settings could not be checked. Please try again before choosing a group meal.");
    const parsed = z.array(medicationAccountSchema.pick({ user_id: true, use_in_groups: true, revision: true })).safeParse(data ?? []);
    if (!parsed.success) throw storageError();
    return parsed.data;
  }

  private async medicationInputs(userIds: string[]) {
    const metadata = await this.medicationMetadata(userIds);
    const optedIn = metadata.filter((entry) => entry.use_in_groups);
    // Do not load the medication names of people who have not opted in.
    const { data, error } = optedIn.length ? await this.adminClient.from("user_medication_profiles")
      .select(MEDICATION_ACCOUNT_SELECT).in("user_id", optedIn.map((entry) => entry.user_id)).eq("use_in_groups", true) : { data: [], error: null };
    if (error) throw storageError();
    const parsed = z.array(medicationAccountSchema).safeParse(data ?? []);
    if (!parsed.success) throw storageError();
    if (parsed.data.length !== optedIn.length || parsed.data.some((entry) => !optedIn.some((saved) => saved.user_id === entry.user_id && saved.revision === entry.revision))) {
      throw new GroupSessionError("invalid-state", "Medication settings changed during computation. Please recompute.");
    }
    return { medicationAccounts: parsed.data, medicationVersions: medicationVersions(userIds, metadata) };
  }

  async getForUser(userId: string, sessionId: string): Promise<GroupSessionDetail | null> {
    const session = await this.sessionRowForUser(sessionId);
    if (!session) return null;

    const [membersResult, candidatesResult, ownPreferenceResult, latestResult] =
      await Promise.all([
        this.userClient
          .from("group_session_members")
          .select(MEMBER_SELECT)
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true }),
        this.userClient
          .from("group_session_candidates")
          .select("venue_id")
          .eq("session_id", sessionId)
          .order("venue_id", { ascending: true }),
        this.userClient
          .from("group_session_meal_preferences")
          .select("user_id,state_version,preference_state,updated_at")
          .eq("session_id", sessionId)
          .eq("user_id", userId)
          .maybeSingle(),
        this.userClient
          .from("group_recommendation_results")
          .select("id,algorithm_version,input_hash,result_snapshot,created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (
      membersResult.error ||
      candidatesResult.error ||
      ownPreferenceResult.error ||
      latestResult.error
    ) throw storageError();

    const members = z.array(memberRowSchema).safeParse(membersResult.data ?? []);
    if (!members.success) throw storageError();
    const candidateIds = z
      .array(z.object({ venue_id: z.string().uuid() }))
      .safeParse(candidatesResult.data ?? []);
    if (!candidateIds.success) throw storageError();
    const ownPreference = ownPreferenceResult.data
      ? preferenceRowSchema.safeParse(ownPreferenceResult.data)
      : null;
    if (ownPreference && !ownPreference.success) throw storageError();

    // Only readiness timestamps are loaded with server credentials. Other
    // members' preference JSON never enters this response path.
    const readinessResult = members.data.length
      ? await this.adminClient
          .from("group_session_meal_preferences")
          .select("user_id,state_version,updated_at")
          .eq("session_id", sessionId)
          .in("user_id", members.data.map((member) => member.user_id))
      : { data: [], error: null };
    if (readinessResult.error) throw storageError();
    const readiness = z.array(preferenceRowSchema.omit({ preference_state: true }))
      .safeParse(readinessResult.data ?? []);
    if (!readiness.success) throw storageError();
    const readinessByUser = new Map(readiness.data.map((row) => [
      row.user_id,
      { ...row, preference_state: {} } as PreferenceRow,
    ]));
    const names = await this.displayNames(members.data.map((member) => member.user_id));

    const ownMembership = members.data.find((member) => member.user_id === userId);
    const parsedLatest = latestResult.data
      ? resultRowSchema.safeParse(latestResult.data)
      : null;
    if (parsedLatest && !parsedLatest.success) throw storageError();

    let latest = parsedLatest?.success ? resultSnapshot(parsedLatest.data, sessionId) : undefined;
    let recommendationNeedsRefresh = session.status === "decided" && !latest;
    if (latest && ownMembership?.status === "accepted") {
      const acceptedIds = members.data.filter((entry) => entry.status === "accepted").map((entry) => entry.user_id);
      const versions = medicationVersions(acceptedIds, await this.medicationMetadata(acceptedIds));
      const summary = latest.recommendation.medicationSummary;
      if (!summary || summary.rulesVersion !== MEDICATION_RULES_VERSION || summary.revisionFingerprint !== medicationVersionFingerprint(versions)) {
        latest = undefined;
        recommendationNeedsRefresh = true;
      }
    }

    return {
      session: {
        id: session.id,
        title: session.name ?? "Group meal",
        createdByUserId: session.creator_id,
        candidateVenueIds: candidateIds.data.map((candidate) => candidate.venue_id),
        status: sharedSessionStatus(session.status),
        ...(session.scheduled_for ? { scheduledFor: session.scheduled_for } : {}),
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      members: members.data.map((member) => memberSummary(
        member,
        names.get(member.user_id) ?? "TasteDNA user",
        readinessByUser.get(member.user_id),
      )),
      ...(ownMembership?.status === "accepted"
        ? {
            ownMealPreferenceState: ownPreference?.success
              ? checkedPreference(ownPreference.data.preference_state)
              : cloneEmptyPreferences(),
          }
        : {}),
      ...(latest ? { latestRecommendation: latest } : {}),
      ...(recommendationNeedsRefresh ? { recommendationNeedsRefresh: true } : {}),
    };
  }

  async create(userId: string, input: CreateGroupSessionInput): Promise<GroupSessionDetail> {
    const { data, error } = await this.adminClient.rpc("create_group_session", {
      p_creator_id: userId,
      p_name: input.title,
      p_scheduled_for: input.scheduledFor ?? null,
      p_invitee_ids: input.inviteeUserIds,
      p_candidate_venue_ids: input.candidateVenueIds,
    });
    if (error) {
      if (error.code === "42501") {
        throw new GroupSessionError("forbidden", "Only accepted friends can be invited.");
      }
      if (error.code === "22023" || error.code === "23503") {
        throw new GroupSessionError("invalid-state", "Choose three to five active, unique venues.");
      }
      throw storageError();
    }
    const sessionId = z.string().uuid().safeParse(data);
    if (!sessionId.success) throw storageError();
    const detail = await this.getForUser(userId, sessionId.data);
    if (!detail) throw storageError();
    return detail;
  }

  async invite(
    userId: string,
    sessionId: string,
    inviteeUserId: string,
  ): Promise<GroupSessionDetail> {
    const session = await this.sessionRowForUser(sessionId);
    if (!session) throw new GroupSessionError("not-found", "Group session not found.");
    if (session.creator_id !== userId) {
      throw new GroupSessionError("forbidden", "Only the creator can invite members.");
    }
    if (session.status === "closed") {
      throw new GroupSessionError("invalid-state", "This session is closed.");
    }
    if (inviteeUserId === userId) {
      throw new GroupSessionError("invalid-state", "The creator is already a member.");
    }

    const { data: friendship, error: friendshipError } = await this.adminClient
      .from("friendships")
      .select("id")
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${inviteeUserId}),and(requester_id.eq.${inviteeUserId},addressee_id.eq.${userId})`,
      )
      .eq("status", "accepted")
      .maybeSingle();
    if (friendshipError) throw storageError();
    if (!friendship) {
      throw new GroupSessionError("forbidden", "Only accepted friends can be invited.");
    }

    const { error } = await this.userClient.from("group_session_members").insert({
      session_id: sessionId,
      user_id: inviteeUserId,
      invited_by: userId,
      status: "invited",
    });
    if (error) {
      if (error.code === "23505") {
        throw new GroupSessionError("invalid-state", "That person is already in this session.");
      }
      throw storageError();
    }
    const detail = await this.getForUser(userId, sessionId);
    if (!detail) throw storageError();
    return detail;
  }

  async respondToInvitation(
    userId: string,
    sessionId: string,
    action: InvitationResponseAction,
  ): Promise<SessionMemberSummary> {
    const status = action === "accept" ? "accepted" : "declined";
    const { data, error } = await this.userClient
      .from("group_session_members")
      .update({ status })
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .eq("status", "invited")
      .select(MEMBER_SELECT)
      .maybeSingle();
    if (error) throw storageError();
    if (!data) throw new GroupSessionError("not-found", "Invitation not found.");
    const parsed = memberRowSchema.safeParse(data);
    if (!parsed.success) throw storageError();
    const names = await this.displayNames([userId]);
    return memberSummary(parsed.data, names.get(userId) ?? "TasteDNA user", undefined);
  }

  async updateMealPreferences(
    userId: string,
    sessionId: string,
    state: MealPreferenceState,
  ): Promise<GroupSessionDetail> {
    const session = await this.sessionRowForUser(sessionId);
    if (!session) throw new GroupSessionError("not-found", "Group session not found.");
    if (session.status === "closed") {
      throw new GroupSessionError("invalid-state", "This session is closed.");
    }

    const { data: existing, error: existingError } = await this.userClient
      .from("group_session_meal_preferences")
      .select("state_version")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) throw storageError();

    const { error } = await this.userClient
      .from("group_session_meal_preferences")
      .upsert({
        session_id: sessionId,
        user_id: userId,
        state_version: (existing?.state_version ?? 0) + 1,
        preference_state: state,
      }, { onConflict: "session_id,user_id" });
    if (error) {
      if (error.code === "42501") {
        throw new GroupSessionError("forbidden", "Accept the invitation before checking in.");
      }
      throw storageError();
    }
    const detail = await this.getForUser(userId, sessionId);
    if (!detail) throw storageError();
    return detail;
  }

  async replaceCandidates(
    userId: string,
    sessionId: string,
    venueIds: string[],
  ): Promise<GroupSessionDetail> {
    const { error } = await this.adminClient.rpc("replace_group_session_candidates", {
      p_creator_id: userId,
      p_session_id: sessionId,
      p_candidate_venue_ids: venueIds,
    });
    if (error) {
      if (error.code === "42501") {
        throw new GroupSessionError("forbidden", "Only the creator can change candidates.");
      }
      if (error.code === "22023" || error.code === "23503") {
        throw new GroupSessionError("invalid-state", "Choose three to five active, unique venues.");
      }
      throw storageError();
    }
    const detail = await this.getForUser(userId, sessionId);
    if (!detail) throw new GroupSessionError("not-found", "Group session not found.");
    return detail;
  }

  async loadComputationInput(
    userId: string,
    sessionId: string,
  ): Promise<GroupSessionComputationInput> {
    const session = await this.sessionRowForUser(sessionId);
    if (!session) throw new GroupSessionError("not-found", "Group session not found.");
    if (session.creator_id !== userId) {
      throw new GroupSessionError("forbidden", "Only the creator can compute this session.");
    }
    if (session.status === "closed") {
      throw new GroupSessionError("invalid-state", "This session is closed.");
    }

    const [membersResult, candidatesResult] = await Promise.all([
      this.adminClient
        .from("group_session_members")
        .select(MEMBER_SELECT)
        .eq("session_id", sessionId)
        .eq("status", "accepted")
        .order("user_id", { ascending: true }),
      this.adminClient
        .from("group_session_candidates")
        .select("venue_id")
        .eq("session_id", sessionId)
        .order("venue_id", { ascending: true }),
    ]);
    if (membersResult.error || candidatesResult.error) throw storageError();
    const members = z.array(memberRowSchema).safeParse(membersResult.data ?? []);
    const candidates = z.array(z.object({ venue_id: z.string().uuid() }))
      .safeParse(candidatesResult.data ?? []);
    if (!members.success || !candidates.success) throw storageError();
    if (members.data.length === 0 || candidates.data.length === 0) {
      throw new GroupSessionError("missing-input", "The session needs members and candidate venues.");
    }

    const memberIds = members.data.map((member) => member.user_id);
    const venueIds = candidates.data.map((candidate) => candidate.venue_id);
    const [preferencesResult, profilesResult, names, storedVenues, sharedMenus, medicationInputs] =
      await Promise.all([
        this.adminClient
          .from("group_session_meal_preferences")
          .select("user_id,state_version,preference_state,updated_at")
          .eq("session_id", sessionId)
          .in("user_id", memberIds),
        this.adminClient
          .from("taste_profiles")
          .select("user_id,profile_state,updated_at")
          .in("user_id", memberIds),
        this.displayNames(memberIds),
        new SupabaseCmuVenueRepository(this.adminClient).listActiveVenues(),
        new SupabaseSharedMenuRepository(this.adminClient).listNewestValidForVenues(venueIds),
        this.medicationInputs(memberIds),
      ]);
    if (preferencesResult.error || profilesResult.error) throw storageError();

    const preferences = z.array(preferenceRowSchema).safeParse(preferencesResult.data ?? []);
    const profiles = z.array(z.object({
      user_id: z.string().uuid(),
      profile_state: z.unknown(),
      updated_at: z.string(),
    })).safeParse(profilesResult.data ?? []);
    if (!preferences.success || !profiles.success) throw storageError();

    const preferenceByUser = new Map(preferences.data.map((row) => [row.user_id, row]));
    const profileByUser = new Map(profiles.data.map((row) => [row.user_id, row]));
    const decisionMembers = members.data.map((member) => {
      const storedProfile = profileByUser.get(member.user_id);
      const profile = tasteProfileSchema.safeParse(storedProfile?.profile_state);
      if (!profile.success || profile.data.userId !== member.user_id) {
        throw new GroupSessionError(
          "missing-input",
          "Every accepted member needs a saved TasteDNA profile before computing.",
        );
      }
      const preference = preferenceByUser.get(member.user_id);
      return {
        member: {
          sessionId,
          userId: member.user_id,
          displayName: names.get(member.user_id) ?? "TasteDNA user",
          status: preference ? "responded" as const : "joined" as const,
          mealPreferenceState: preference
            ? checkedPreference(preference.preference_state)
            : cloneEmptyPreferences(),
          ...(preference ? { respondedAt: preference.updated_at } : {}),
        },
        profile: profile.data,
      };
    });

    const storedVenueById = new Map(storedVenues.map((venue) => [venue.id, venue]));
    const venues = venueIds.map((venueId) => {
      const storedVenue = storedVenueById.get(venueId);
      return storedVenue
        ? storedVenueToPublicVenue(storedVenue, sharedMenus.get(venueId))
        : null;
    }).filter((venue): venue is Venue => venue !== null);

    if (!venues.some((venue) => venue.menuItems.length > 0)) {
      throw new GroupSessionError(
        "missing-input",
        "None of the candidate venues has a usable shared menu yet.",
      );
    }

    const rankingInput = {
      session: {
        id: session.id,
        title: session.name ?? "Group meal",
        createdByUserId: session.creator_id,
        candidateVenueIds: venueIds,
        status: sharedSessionStatus(session.status),
        ...(session.scheduled_for ? { scheduledFor: session.scheduled_for } : {}),
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
      venues,
      members: decisionMembers,
    };

    return {
      rankingInput,
      ...medicationInputs,
      identity: {
        sessionId: session.id,
        candidateVenueIds: venueIds,
        members: decisionMembers.map((entry) => ({
          userId: entry.member.userId,
          displayName: entry.member.displayName,
          mealPreferenceState: entry.member.mealPreferenceState,
          profile: entry.profile,
        })),
        venues,
        menus: venueIds.map((venueId) => ({
          venueId,
          ...(sharedMenus.has(venueId)
            ? {
                menuId: sharedMenus.get(venueId)!.menuId,
                version: sharedMenus.get(venueId)!.version,
                observedAt: sharedMenus.get(venueId)!.observedAt,
                validFrom: sharedMenus.get(venueId)!.validFrom,
                validUntil: sharedMenus.get(venueId)!.validUntil,
              }
            : { menuId: null }),
        })),
      },
    };
  }

  async persistRecommendation(
    userId: string,
    sessionId: string,
    algorithmVersion: string,
    inputHash: string,
    recommendation: GroupRecommendation,
    medicationVersions: Record<string, string>,
  ): Promise<RecommendationSnapshot> {
    const { data, error } = await this.adminClient.rpc("persist_medication_group_recommendation", {
      p_session_id: sessionId,
      p_algorithm_version: algorithmVersion,
      p_input_hash: inputHash,
      p_result_snapshot: recommendation,
      p_computed_by: userId,
      p_medication_versions: medicationVersions,
    });
    if (error) {
      if (error.code === "40001") throw new GroupSessionError("invalid-state", "Medication settings or group membership changed. Please recompute before choosing.");
      if (error.code === "42501") {
        throw new GroupSessionError("forbidden", "Only the creator can compute this session.");
      }
      throw storageError();
    }
    const resultId = z.string().uuid().safeParse(data);
    if (!resultId.success) throw storageError();
    const { data: stored, error: storedError } = await this.adminClient
      .from("group_recommendation_results")
      .select("id,algorithm_version,input_hash,result_snapshot,created_at")
      .eq("id", resultId.data)
      .single();
    if (storedError) throw storageError();
    const parsed = resultRowSchema.safeParse(stored);
    if (!parsed.success) throw storageError();
    return resultSnapshot(parsed.data, sessionId);
  }
}
