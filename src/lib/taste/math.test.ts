import { describe, expect, it } from "vitest";
import { cosineSimilarity, normalizeVector, ratingToWeight } from "./math";

describe("taste math", () => {
  it("maps 1–5 ratings into centered preference weights", () => {
    expect([1, 2, 3, 4, 5].map((rating) => ratingToWeight(rating as 1 | 2 | 3 | 4 | 5))).toEqual([-1, -.5, 0, .5, 1]);
  });

  it("normalizes vectors without changing an empty signal", () => {
    expect(normalizeVector([3, 4])).toEqual([.6, .8]);
    expect(normalizeVector([0, 0])).toEqual([0, 0]);
  });

  it("computes cosine similarity and safely handles mismatched dimensions", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(cosineSimilarity([1], [1, 0])).toBe(0);
  });
});
