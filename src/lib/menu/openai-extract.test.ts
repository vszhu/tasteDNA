import { describe, expect, it } from "vitest";
import { SAMPLE_MENU_MODEL } from "./sample";
import { extractMenuWithOpenAI } from "./openai-extract";

describe("OpenAI menu extraction fallback", () => {
  it("uses only the fast primary model when its structured result is valid", async () => {
    const calls: string[] = [];
    const result = await extractMenuWithOpenAI({ text: "menu" }, {
      primaryModel: "gpt-5.6-luna",
      fallbackModel: "gpt-5.6-terra",
      requestModel: async (model) => {
        calls.push(model);
        return SAMPLE_MENU_MODEL;
      },
    });

    expect(calls).toEqual(["gpt-5.6-luna"]);
    expect(result.usedModelFallback).toBe(false);
    expect(result.model).toBe("gpt-5.6-luna");
    expect(result.menu.dishes).toHaveLength(SAMPLE_MENU_MODEL.dishes.length);
  });

  it("calls Terra only after the primary request fails", async () => {
    const calls: string[] = [];
    const result = await extractMenuWithOpenAI({ text: "menu" }, {
      primaryModel: "gpt-5.6-luna",
      fallbackModel: "gpt-5.6-terra",
      requestModel: async (model) => {
        calls.push(model);
        if (model === "gpt-5.6-luna") throw new Error("primary unavailable");
        return SAMPLE_MENU_MODEL;
      },
    });

    expect(calls).toEqual(["gpt-5.6-luna", "gpt-5.6-terra"]);
    expect(result.usedModelFallback).toBe(true);
    expect(result.primaryFailureReason).toBe("request_failed");
  });

  it("falls back after invalid or empty structured output", async () => {
    const invalidCalls: string[] = [];
    const invalidResult = await extractMenuWithOpenAI({ text: "menu" }, {
      primaryModel: "primary",
      fallbackModel: "fallback",
      requestModel: async (model) => {
        invalidCalls.push(model);
        return model === "primary" ? { dishes: "corrupted" } : SAMPLE_MENU_MODEL;
      },
    });

    const emptyResult = await extractMenuWithOpenAI({ text: "menu" }, {
      primaryModel: "primary",
      fallbackModel: "fallback",
      requestModel: async (model) => model === "primary"
        ? { restaurantName: null, currency: "USD", dishes: [] }
        : SAMPLE_MENU_MODEL,
    });

    expect(invalidCalls).toEqual(["primary", "fallback"]);
    expect(invalidResult.primaryFailureReason).toBe("invalid_structured_output");
    expect(emptyResult.primaryFailureReason).toBe("empty_menu");
  });

  it("reports a safe categorized error when both attempts fail", async () => {
    const requestModel = async () => {
      const error = new Error("rate limited") as Error & { status: number };
      error.status = 429;
      throw error;
    };

    await expect(extractMenuWithOpenAI({ text: "menu" }, {
      primaryModel: "primary",
      fallbackModel: "fallback",
      requestModel,
    })).rejects.toEqual(expect.objectContaining({
      primaryReason: "rate_limit",
      fallbackReason: "rate_limit",
    }));
  });
});
