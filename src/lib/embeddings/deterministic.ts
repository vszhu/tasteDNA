import type { EmbeddingProvider } from "./types";
import { normalizeVector } from "@/lib/taste/math";

export const DEMO_EMBEDDING_DIMENSIONS = 64;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A stable local projection used in demo mode. Token and adjacent-token features
 * preserve meaningful overlap while keeping identical inputs fully reproducible.
 */
export function deterministicEmbedding(text: string, dimensions = DEMO_EMBEDDING_DIMENSIONS) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const features = [...tokens, ...tokens.slice(1).map((token, index) => `${token}_${tokens[index + 1]}`)];

  features.forEach((feature, index) => {
    const hash = stableHash(feature);
    const bucket = hash % dimensions;
    const sign = (hash >>> 7) % 2 === 0 ? 1 : -1;
    vector[bucket] += sign * (index < tokens.length ? 1 : 0.55);
  });

  return normalizeVector(vector);
}

export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly name = "deterministic-local";

  async embed(texts: string[]) {
    return texts.map((text) => deterministicEmbedding(text));
  }
}
