import { describe, expect, it } from "vitest";
import {
  calculateOptimizedDimensions,
  MENU_IMAGE_MAX_LONG_EDGE,
  shouldOptimizeMenuImage,
} from "./image-optimization";

describe("menu image optimization", () => {
  it("preserves aspect ratio and does not upscale small images", () => {
    expect(calculateOptimizedDimensions(4_032, 3_024)).toEqual({ width: 1_920, height: 1_440 });
    expect(calculateOptimizedDimensions(3_024, 4_032)).toEqual({ width: 1_440, height: 1_920 });
    expect(calculateOptimizedDimensions(1_200, 900)).toEqual({ width: 1_200, height: 900 });
  });

  it("optimizes oversized dimensions or files while leaving reasonable images alone", () => {
    expect(shouldOptimizeMenuImage(MENU_IMAGE_MAX_LONG_EDGE + 1, 1_000, 500_000)).toBe(true);
    expect(shouldOptimizeMenuImage(1_600, 1_200, 3 * 1024 * 1024)).toBe(true);
    expect(shouldOptimizeMenuImage(1_600, 1_200, 2 * 1024 * 1024)).toBe(false);
  });
});
