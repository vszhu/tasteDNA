import type { GroupRankingInput } from "@/lib/group/ranking";
import type {
  DiningSession,
  DiningSessionMember,
  GroupRecommendation,
  MealPreferenceState,
} from "@/types/group";

export type SessionMemberSummary = Omit<DiningSessionMember, "mealPreferenceState"> & {
  hasMealPreferences: boolean;
};

export interface RecommendationSnapshot {
  id: string;
  algorithmVersion: string;
  inputHash: string;
  recommendation: GroupRecommendation;
  computedAt: string;
}

export interface GroupSessionDetail {
  session: DiningSession;
  members: SessionMemberSummary[];
  ownMealPreferenceState?: MealPreferenceState;
  latestRecommendation?: RecommendationSnapshot;
}

export interface CreateGroupSessionInput {
  title: string;
  scheduledFor?: string;
  inviteeUserIds: string[];
  candidateVenueIds: string[];
}

export interface GroupSessionComputationInput {
  rankingInput: GroupRankingInput;
  identity: unknown;
}

export type InvitationResponseAction = "accept" | "decline";

export interface GroupSessionRepository {
  create(userId: string, input: CreateGroupSessionInput): Promise<GroupSessionDetail>;
  getForUser(userId: string, sessionId: string): Promise<GroupSessionDetail | null>;
  invite(userId: string, sessionId: string, inviteeUserId: string): Promise<GroupSessionDetail>;
  respondToInvitation(
    userId: string,
    sessionId: string,
    action: InvitationResponseAction,
  ): Promise<SessionMemberSummary>;
  updateMealPreferences(
    userId: string,
    sessionId: string,
    state: MealPreferenceState,
  ): Promise<GroupSessionDetail>;
  replaceCandidates(
    userId: string,
    sessionId: string,
    venueIds: string[],
  ): Promise<GroupSessionDetail>;
  loadComputationInput(userId: string, sessionId: string): Promise<GroupSessionComputationInput>;
  persistRecommendation(
    userId: string,
    sessionId: string,
    algorithmVersion: string,
    inputHash: string,
    recommendation: GroupRecommendation,
  ): Promise<RecommendationSnapshot>;
}

export interface GroupRecommendationEngine {
  algorithmVersion: string;
  compute(input: GroupRankingInput): GroupRecommendation | null;
}

export type GroupSessionErrorCode =
  | "forbidden"
  | "invalid-state"
  | "missing-input"
  | "not-found"
  | "storage";

export class GroupSessionError extends Error {
  constructor(
    readonly code: GroupSessionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GroupSessionError";
  }
}
