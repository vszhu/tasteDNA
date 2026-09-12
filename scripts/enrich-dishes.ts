/**
 * Turns bare CMU menu item names into full TasteDNA dish records.
 *
 * The production extractor in src/lib/menu/openai-extract.ts is deliberately
 * forbidden from inventing anything, because it reads a photographed menu that
 * already contains descriptions and prices. This dataset is only item NAMES, so
 * a separate, explicitly-labelled inference step is used instead. Every dish it
 * produces is marked with a reduced confidence and carries "description" in
 * unknownFields, so the UI keeps showing it as inferred rather than observed.
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { extractedDishSchema, type ExtractedDishInput } from "../src/lib/menu/schema";
import {
  MENU_FALLBACK_MODEL,
  MENU_PRIMARY_MODEL,
  MENU_REASONING_EFFORT,
  MENU_REQUEST_TIMEOUT_MS,
} from "../src/lib/menu/model-config";

/** Kept well under the model's comfortable structured-output size. */
export const ENRICHMENT_BATCH_SIZE = 25;

const enrichedMenuSchema = z.object({ dishes: z.array(extractedDishSchema).max(ENRICHMENT_BATCH_SIZE) });

const SYSTEM_PROMPT = `You are enriching a real university dining menu for TasteDNA.

You receive the venue name, its concept description, and a list of menu item names that genuinely exist at that venue. For EVERY name you receive, return exactly one dish object, in the same order. Never drop, merge, rename, or add an item.

The names are real; the details are not supplied. Infer the most likely description, cuisine, major ingredients, protein types, carbohydrate or base types, and cooking methods from the item name plus the venue's concept. Write each description as one short, concrete phrase a diner would recognise (at most 18 words). Do not invent prices; always return null for price.

Score every flavour and texture dimension between 0 and 1 using the whole range. A dish that is genuinely spicy should score high on spicy; a salad should score high on fresh; a milkshake should score high on sweet and creamy. Do not flatten everything to a neutral mid value - these scores drive the recommendation engine, and uniform scores make it useless.

Set confidence to how well the name alone determines the dish: about 0.75 for an unambiguous item like "Chocolate Chip Cookie", about 0.45 for a vague one like "Daily Special". Always include "description" in unknownFields, because the description was inferred rather than read from the menu. Use the venue's category when the name implies one, otherwise "Unknown".`;

export interface EnrichmentVenueContext {
  venueName: string;
  conceptDescription: string;
}

function userPrompt(context: EnrichmentVenueContext, names: string[]) {
  return [
    `Venue: ${context.venueName}`,
    `Concept: ${context.conceptDescription || "Unknown"}`,
    `Return exactly ${names.length} dish objects, in this order:`,
    ...names.map((name, index) => `${index + 1}. ${name}`),
  ].join("\n");
}

/** Falls back to a low-confidence placeholder so one bad name cannot fail a venue. */
function placeholderDish(name: string): ExtractedDishInput {
  return {
    name,
    description: "",
    price: null,
    category: "Unknown",
    cuisine: "Unknown",
    ingredients: [],
    sweet: 0.2, salty: 0.2, sour: 0.2, bitter: 0.2,
    umami: 0.2, spicy: 0.2, rich: 0.2, fresh: 0.2,
    crispy: 0.2, creamy: 0.2, chewy: 0.2, smoky: 0.2,
    proteinTypes: [],
    carbohydrateTypes: [],
    cookingMethods: [],
    confidence: 0.2,
    unknownFields: ["description", "cuisine", "ingredients"],
  };
}

async function enrichBatch(
  client: OpenAI,
  context: EnrichmentVenueContext,
  names: string[],
  model: string,
): Promise<ExtractedDishInput[]> {
  const response = await client.responses.parse({
    model,
    instructions: SYSTEM_PROMPT,
    input: [{ role: "user", content: [{ type: "input_text", text: userPrompt(context, names) }] }],
    reasoning: { effort: MENU_REASONING_EFFORT },
    text: { format: zodTextFormat(enrichedMenuSchema, "tastedna_enriched_menu"), verbosity: "low" },
    max_output_tokens: 16_000,
    prompt_cache_key: "tastedna-cmu-menu-enrichment-v1",
    store: false,
  }, { maxRetries: 1, timeout: MENU_REQUEST_TIMEOUT_MS });

  const parsed = response.output_parsed;
  if (!parsed) throw new Error("The enrichment model returned no structured output.");

  // Realign on the names we asked for; the model occasionally reorders.
  const byName = new Map(parsed.dishes.map((dish) => [dish.name.toLowerCase().trim(), dish]));
  return names.map((name, index) => {
    const matched = byName.get(name.toLowerCase().trim()) ?? parsed.dishes[index];
    if (!matched) return placeholderDish(name);
    const unknownFields = matched.unknownFields.includes("description")
      ? matched.unknownFields
      : [...matched.unknownFields, "description"];
    return { ...matched, name, unknownFields };
  });
}

export async function enrichVenueDishes(
  context: EnrichmentVenueContext,
  names: string[],
  log: (message: string) => void = () => {},
): Promise<ExtractedDishInput[]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const dishes: ExtractedDishInput[] = [];

  for (let start = 0; start < names.length; start += ENRICHMENT_BATCH_SIZE) {
    const batch = names.slice(start, start + ENRICHMENT_BATCH_SIZE);
    try {
      dishes.push(...await enrichBatch(client, context, batch, MENU_PRIMARY_MODEL));
    } catch (primaryError) {
      log(`    primary model failed (${primaryError instanceof Error ? primaryError.name : "unknown"}); trying ${MENU_FALLBACK_MODEL}`);
      try {
        dishes.push(...await enrichBatch(client, context, batch, MENU_FALLBACK_MODEL));
      } catch {
        log(`    both models failed for ${batch.length} items; storing them as low-confidence placeholders`);
        dishes.push(...batch.map(placeholderDish));
      }
    }
  }

  return dishes;
}
