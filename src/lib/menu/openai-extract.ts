import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ZodError } from "zod";
import { extractedMenuModelSchema, type ExtractedMenuModel } from "./schema";
import {
  MENU_FALLBACK_MODEL,
  MENU_PRIMARY_MODEL,
  MENU_REASONING_EFFORT,
  MENU_REQUEST_TIMEOUT_MS,
} from "./model-config";

const SYSTEM_PROMPT = `You are the single menu-understanding step for TasteDNA.

Extract only dishes visibly present in the supplied restaurant menu image or explicitly present in pasted menu text. Never invent, complete, or add a dish that is not visible. Return one object per unique menu item in its visible menu order.

In this one response, provide the listed name, description, numeric price without a currency symbol, menu category or section, cuisine, major ingredients, protein types, carbohydrate or base types, cooking methods, and every requested flavor or texture score. Scores must be conservative numbers from 0 to 1. Use "Unknown", an empty array, or a neutral low score when a detail cannot be reasonably inferred; lower confidence and name uncertain fields in unknownFields. Do not treat section headings, add-ons, sizes, or prices as dishes. Use a three-letter ISO 4217 currency code.`;

export type MenuExtractionFailureReason =
  | "empty_menu"
  | "invalid_structured_output"
  | "rate_limit"
  | "timeout"
  | "request_failed";

export interface MenuExtractionResult {
  menu: ExtractedMenuModel;
  model: string;
  usedModelFallback: boolean;
  primaryFailureReason?: MenuExtractionFailureReason;
  extractionMs: number;
}

export class MenuExtractionFailedError extends Error {
  constructor(
    readonly primaryReason: MenuExtractionFailureReason,
    readonly fallbackReason?: MenuExtractionFailureReason,
  ) {
    super("Both menu extraction attempts failed.");
    this.name = "MenuExtractionFailedError";
  }
}

class EmptyMenuError extends Error {
  constructor() {
    super("No menu items were extracted.");
    this.name = "EmptyMenuError";
  }
}

type MenuModelRequest = (model: string) => Promise<unknown>;

interface ExtractionOptions {
  primaryModel?: string;
  fallbackModel?: string;
  requestModel?: MenuModelRequest;
}

function failureReason(error: unknown): MenuExtractionFailureReason {
  if (error instanceof EmptyMenuError) return "empty_menu";
  if (error instanceof ZodError || error instanceof SyntaxError) return "invalid_structured_output";
  if (typeof error === "object" && error) {
    const status = "status" in error ? Number(error.status) : undefined;
    const name = "name" in error ? String(error.name).toLowerCase() : "";
    if (status === 429) return "rate_limit";
    if (name.includes("timeout") || name.includes("abort")) return "timeout";
  }
  return "request_failed";
}

function validateMenu(value: unknown) {
  const menu = extractedMenuModelSchema.parse(value);
  if (menu.dishes.length === 0) throw new EmptyMenuError();
  return menu;
}

function developmentLog(label: string, details: Record<string, string | number | boolean | undefined>) {
  if (process.env.NODE_ENV === "development") console.info(`[TasteDNA timing] ${label}`, details);
}

async function requestWithOpenAI(
  client: OpenAI,
  input: { text?: string; image?: { mimeType: string; base64: string } },
  model: string,
) {
  const userContent: OpenAI.Responses.ResponseInputContent[] = [];
  if (input.text) userContent.push({ type: "input_text", text: `Extract this menu:\n\n${input.text}` });
  if (input.image) {
    userContent.push({
      type: "input_image",
      image_url: `data:${input.image.mimeType};base64,${input.image.base64}`,
      detail: "high",
    });
  }

  const response = await client.responses.parse({
    model,
    instructions: SYSTEM_PROMPT,
    input: [{ role: "user", content: userContent }],
    reasoning: { effort: MENU_REASONING_EFFORT },
    text: {
      format: zodTextFormat(extractedMenuModelSchema, "taste_dna_menu"),
      verbosity: "low",
    },
    max_output_tokens: 16_000,
    prompt_cache_key: "tastedna-menu-extraction-v2",
    store: false,
  }, {
    maxRetries: 0,
    timeout: MENU_REQUEST_TIMEOUT_MS,
  });

  return response.output_parsed;
}

export async function extractMenuWithOpenAI(
  input: { text?: string; image?: { mimeType: string; base64: string } },
  options: ExtractionOptions = {},
): Promise<MenuExtractionResult> {
  const primaryModel = options.primaryModel ?? MENU_PRIMARY_MODEL;
  const fallbackModel = options.fallbackModel ?? MENU_FALLBACK_MODEL;
  const client = options.requestModel ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const requestModel = options.requestModel ?? ((model: string) => requestWithOpenAI(client!, input, model));
  const totalStarted = performance.now();

  try {
    const attemptStarted = performance.now();
    const menu = validateMenu(await requestModel(primaryModel));
    developmentLog("multimodal menu extraction", {
      model: primaryModel,
      durationMs: Math.round(performance.now() - attemptStarted),
      fallback: false,
    });
    return {
      menu,
      model: primaryModel,
      usedModelFallback: false,
      extractionMs: Math.round(performance.now() - totalStarted),
    };
  } catch (primaryError) {
    const primaryReason = failureReason(primaryError);
    if (primaryModel === fallbackModel) throw new MenuExtractionFailedError(primaryReason);

    if (process.env.NODE_ENV === "development") {
      console.warn("[TasteDNA] Falling back to the backup menu model", {
        primaryModel,
        fallbackModel,
        reason: primaryReason,
      });
    }

    try {
      const attemptStarted = performance.now();
      const menu = validateMenu(await requestModel(fallbackModel));
      developmentLog("multimodal menu extraction", {
        model: fallbackModel,
        durationMs: Math.round(performance.now() - attemptStarted),
        fallback: true,
        primaryFailureReason: primaryReason,
      });
      return {
        menu,
        model: fallbackModel,
        usedModelFallback: true,
        primaryFailureReason: primaryReason,
        extractionMs: Math.round(performance.now() - totalStarted),
      };
    } catch (fallbackError) {
      throw new MenuExtractionFailedError(primaryReason, failureReason(fallbackError));
    }
  }
}
