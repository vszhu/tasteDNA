import { z } from "zod";
import type { GroupRecommendation, MealPreferenceState } from "@/types/group";
import { mealPreferenceStateSchema } from "./schemas";
import type {
  CreateGroupSessionInput,
  GroupSessionDetail,
  InvitationResponseAction,
  RecommendationSnapshot,
} from "./types";

const sessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  createdByUserId: z.string().uuid(),
  candidateVenueIds: z.array(z.string().uuid()),
  status: z.enum(["draft", "open", "revealed", "cancelled"]),
  scheduledFor: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const memberSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  status: z.enum(["invited", "joined", "declined", "responded"]),
  hasMealPreferences: z.boolean(),
  respondedAt: z.string().optional(),
});

function isRecommendation(value: unknown): value is GroupRecommendation {
  return Boolean(
    value &&
    typeof value === "object" &&
    "sessionId" in value &&
    typeof value.sessionId === "string" &&
    "winner" in value &&
    "assignments" in value &&
    Array.isArray(value.assignments) &&
    "venueScores" in value &&
    Array.isArray(value.venueScores),
  );
}

const recommendationSnapshotSchema = z.object({
  id: z.string().uuid(),
  algorithmVersion: z.string(),
  inputHash: z.string(),
  recommendation: z.custom<GroupRecommendation>(isRecommendation),
  computedAt: z.string(),
});

const detailSchema = z.object({
  session: sessionSchema,
  members: z.array(memberSchema),
  ownMealPreferenceState: mealPreferenceStateSchema.optional(),
  latestRecommendation: recommendationSnapshotSchema.optional(),
});

const membershipResponseSchema = z.object({ member: memberSchema }).or(
  z.object({ membership: memberSchema }),
);
const recommendationResponseSchema = z.object({ result: recommendationSnapshotSchema });
const errorResponseSchema = z.object({ error: z.string().min(1).max(300) });

export class GroupSessionClientError extends Error {
  constructor(
    message = "Group sessions are temporarily unavailable. Please try again.",
    readonly status?: number,
  ) {
    super(message);
    this.name = "GroupSessionClientError";
  }
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function successfulBody(response: Response): Promise<unknown> {
  const body = await responseBody(response);
  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    throw new GroupSessionClientError(
      parsed.success ? parsed.data.error : undefined,
      response.status,
    );
  }
  return body;
}

function sessionPath(sessionId: string, suffix = "") {
  return `/api/group-sessions/${encodeURIComponent(sessionId)}${suffix}`;
}

function jsonRequest(method: "POST" | "PUT" | "PATCH", body?: unknown): RequestInit {
  return {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  };
}

export function createGroupSessionClient(fetcher: typeof fetch = fetch) {
  async function detail(response: Response): Promise<GroupSessionDetail> {
    const parsed = detailSchema.safeParse(await successfulBody(response));
    if (!parsed.success) throw new GroupSessionClientError();
    return parsed.data;
  }

  return {
    async create(input: CreateGroupSessionInput): Promise<GroupSessionDetail> {
      return detail(await fetcher("/api/group-sessions", jsonRequest("POST", input)));
    },

    async get(sessionId: string, signal?: AbortSignal): Promise<GroupSessionDetail> {
      return detail(await fetcher(sessionPath(sessionId), {
        method: "GET",
        cache: "no-store",
        ...(signal ? { signal } : {}),
      }));
    },

    async invite(sessionId: string, userId: string): Promise<GroupSessionDetail> {
      return detail(await fetcher(
        sessionPath(sessionId, "/invitations"),
        jsonRequest("POST", { userId }),
      ));
    },

    async respond(
      sessionId: string,
      action: InvitationResponseAction,
    ): Promise<void> {
      const parsed = membershipResponseSchema.safeParse(await successfulBody(await fetcher(
        sessionPath(sessionId, "/invitations"),
        jsonRequest("PATCH", { action }),
      )));
      if (!parsed.success) throw new GroupSessionClientError();
    },

    async updateMealPreferences(
      sessionId: string,
      state: MealPreferenceState,
    ): Promise<GroupSessionDetail> {
      return detail(await fetcher(
        sessionPath(sessionId, "/meal-preferences"),
        jsonRequest("PUT", state),
      ));
    },

    async replaceCandidates(sessionId: string, venueIds: string[]): Promise<GroupSessionDetail> {
      return detail(await fetcher(
        sessionPath(sessionId, "/candidates"),
        jsonRequest("PUT", { venueIds }),
      ));
    },

    async compute(sessionId: string): Promise<RecommendationSnapshot> {
      const parsed = recommendationResponseSchema.safeParse(await successfulBody(await fetcher(
        sessionPath(sessionId, "/recommendation"),
        jsonRequest("POST"),
      )));
      if (!parsed.success) throw new GroupSessionClientError();
      return parsed.data.result;
    },

    async getRecommendation(sessionId: string, signal?: AbortSignal): Promise<RecommendationSnapshot> {
      const parsed = recommendationResponseSchema.safeParse(await successfulBody(await fetcher(
        sessionPath(sessionId, "/recommendation"),
        {
          method: "GET",
          cache: "no-store",
          ...(signal ? { signal } : {}),
        },
      )));
      if (!parsed.success) throw new GroupSessionClientError();
      return parsed.data.result;
    },
  };
}
