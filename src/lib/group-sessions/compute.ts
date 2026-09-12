import { createHash } from "node:crypto";
import { computeGroupRecommendation } from "@/lib/group/ranking";
import {
  GroupSessionError,
  type GroupRecommendationEngine,
  type GroupSessionRepository,
  type RecommendationSnapshot,
} from "./types";

export const productionGroupRecommendationEngine: GroupRecommendationEngine = {
  algorithmVersion: "fair-group-v1.0.0",
  compute: computeGroupRecommendation,
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function groupRecommendationInputHash(identity: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(identity)))
    .digest("hex");
}

export async function computeGroupSessionRecommendation(
  repository: GroupSessionRepository,
  userId: string,
  sessionId: string,
  engine: GroupRecommendationEngine = productionGroupRecommendationEngine,
): Promise<RecommendationSnapshot> {
  const input = await repository.loadComputationInput(userId, sessionId);
  const inputHash = groupRecommendationInputHash(input.identity);
  const recommendation = engine.compute(input.rankingInput);
  if (!recommendation) {
    throw new GroupSessionError(
      "missing-input",
      "A recommendation could not be computed from the current members and menus.",
    );
  }
  if (recommendation.sessionId !== sessionId) {
    throw new GroupSessionError("storage", "The recommendation engine returned an invalid session.");
  }
  return repository.persistRecommendation(
    userId,
    sessionId,
    engine.algorithmVersion,
    inputHash,
    recommendation,
  );
}
