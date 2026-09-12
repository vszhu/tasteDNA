import { NextResponse } from "next/server";
import type { z } from "zod";
import { computeGroupSessionRecommendation } from "./compute";
import {
  createGroupSessionSchema,
  invitationResponseSchema,
  inviteSessionMemberSchema,
  mealPreferenceStateSchema,
  replaceCandidatesSchema,
  sessionIdSchema,
} from "./schemas";
import {
  createGroupSessionRequestContext,
  GroupSessionContextError,
  type GroupSessionRequestContext,
} from "./server-context";
import {
  GroupSessionError,
  type GroupRecommendationEngine,
} from "./types";

export type GroupSessionContextFactory = () => Promise<GroupSessionRequestContext>;

function apiFailure(error: unknown) {
  if (error instanceof GroupSessionContextError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof GroupSessionError) {
    const status = error.code === "not-found"
      ? 404
      : error.code === "forbidden"
        ? 403
        : error.code === "invalid-state" || error.code === "missing-input"
          ? 409
          : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  console.error("Group session API failed", {
    name: error instanceof Error ? error.name : "unknown_error",
  });
  return NextResponse.json(
    { error: "Group sessions are temporarily unavailable. Please try again." },
    { status: 500 },
  );
}

async function parsedBody<T extends z.ZodType>(request: Request, schema: T) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function checkedSessionId(sessionId: string) {
  const parsed = sessionIdSchema.safeParse(sessionId);
  return parsed.success ? parsed.data : null;
}

export async function createGroupSession(
  request: Request,
  contextFactory: GroupSessionContextFactory = createGroupSessionRequestContext,
) {
  const input = await parsedBody(request, createGroupSessionSchema);
  if (!input) {
    return NextResponse.json(
      { error: "Provide a name and three to five unique candidate venues." },
      { status: 400 },
    );
  }
  try {
    const { userId, repository } = await contextFactory();
    const detail = await repository.create(userId, input);
    return NextResponse.json(detail, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function readGroupSession(
  sessionId: string,
  contextFactory: GroupSessionContextFactory = createGroupSessionRequestContext,
) {
  const checkedId = checkedSessionId(sessionId);
  if (!checkedId) {
    return NextResponse.json({ error: "Group session not found." }, { status: 404 });
  }
  try {
    const { userId, repository } = await contextFactory();
    const detail = await repository.getForUser(userId, checkedId);
    return detail
      ? NextResponse.json(detail)
      : NextResponse.json({ error: "Group session not found." }, { status: 404 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function inviteGroupSessionMember(
  request: Request,
  sessionId: string,
  contextFactory: GroupSessionContextFactory = createGroupSessionRequestContext,
) {
  const checkedId = checkedSessionId(sessionId);
  const input = await parsedBody(request, inviteSessionMemberSchema);
  if (!checkedId || !input) {
    return NextResponse.json({ error: "Provide a valid session and friend." }, { status: 400 });
  }
  try {
    const { userId, repository } = await contextFactory();
    const detail = await repository.invite(userId, checkedId, input.userId);
    return NextResponse.json(detail, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function respondToGroupSessionInvitation(
  request: Request,
  sessionId: string,
  contextFactory: GroupSessionContextFactory = createGroupSessionRequestContext,
) {
  const checkedId = checkedSessionId(sessionId);
  const input = await parsedBody(request, invitationResponseSchema);
  if (!checkedId || !input) {
    return NextResponse.json({ error: "Provide a valid invitation response." }, { status: 400 });
  }
  try {
    const { userId, repository } = await contextFactory();
    const membership = await repository.respondToInvitation(userId, checkedId, input.action);
    return NextResponse.json({ membership });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function updateGroupSessionMealPreferences(
  request: Request,
  sessionId: string,
  contextFactory: GroupSessionContextFactory = createGroupSessionRequestContext,
) {
  const checkedId = checkedSessionId(sessionId);
  const input = await parsedBody(request, mealPreferenceStateSchema);
  if (!checkedId || !input) {
    return NextResponse.json({ error: "Provide valid meal preferences." }, { status: 400 });
  }
  try {
    const { userId, repository } = await contextFactory();
    const detail = await repository.updateMealPreferences(userId, checkedId, input);
    return NextResponse.json(detail);
  } catch (error) {
    return apiFailure(error);
  }
}

export async function replaceGroupSessionCandidates(
  request: Request,
  sessionId: string,
  contextFactory: GroupSessionContextFactory = createGroupSessionRequestContext,
) {
  const checkedId = checkedSessionId(sessionId);
  const input = await parsedBody(request, replaceCandidatesSchema);
  if (!checkedId || !input) {
    return NextResponse.json(
      { error: "Provide three to five unique candidate venues." },
      { status: 400 },
    );
  }
  try {
    const { userId, repository } = await contextFactory();
    const detail = await repository.replaceCandidates(userId, checkedId, input.venueIds);
    return NextResponse.json(detail);
  } catch (error) {
    return apiFailure(error);
  }
}

export async function computeGroupSession(
  sessionId: string,
  contextFactory: GroupSessionContextFactory = createGroupSessionRequestContext,
  engine?: GroupRecommendationEngine,
) {
  const checkedId = checkedSessionId(sessionId);
  if (!checkedId) {
    return NextResponse.json({ error: "Group session not found." }, { status: 404 });
  }
  try {
    const { userId, repository } = await contextFactory();
    const result = await computeGroupSessionRecommendation(
      repository,
      userId,
      checkedId,
      engine,
    );
    return NextResponse.json({ result });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function readLatestGroupSessionRecommendation(
  sessionId: string,
  contextFactory: GroupSessionContextFactory = createGroupSessionRequestContext,
) {
  const checkedId = checkedSessionId(sessionId);
  if (!checkedId) {
    return NextResponse.json({ error: "Recommendation not found." }, { status: 404 });
  }
  try {
    const { userId, repository } = await contextFactory();
    const detail = await repository.getForUser(userId, checkedId);
    return detail?.latestRecommendation
      ? NextResponse.json({ result: detail.latestRecommendation })
      : NextResponse.json({ error: "Recommendation not found." }, { status: 404 });
  } catch (error) {
    return apiFailure(error);
  }
}
