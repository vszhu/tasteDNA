import type { Dish, ExtractedMenu, Menu, MenuItem, TasteFeatureVector } from "@/types";
import { TASTE_DIMENSIONS } from "@/types";
import type { ExtractedDishInput, ExtractedMenuModel } from "./schema";
import { DeterministicEmbeddingProvider, deterministicEmbedding } from "@/lib/embeddings/deterministic";
import { normalizeDishText } from "@/lib/embeddings/normalize";
import type { EmbeddingProvider } from "@/lib/embeddings/types";

const MAX_EMBEDDING_CACHE_ENTRIES = 500;
const menuEmbeddingCache = new Map<string, number[]>();

interface DishDraft {
  input: ExtractedDishInput;
  index: number;
  dish: Omit<Dish, "embedding">;
}

interface EmbeddingProcessingOptions {
  embeddingProvider?: EmbeddingProvider;
  embeddingCache?: Map<string, number[]>;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function prepareExtractedMenu(
  extracted: ExtractedMenuModel,
  sourceType: Menu["sourceType"],
) {
  const now = new Date().toISOString();
  const menu: Menu = {
    id: `menu-${Date.now()}`,
    restaurantName: extracted.restaurantName ?? undefined,
    sourceType,
    currency: extracted.currency,
    createdAt: now,
  };

  const seen = new Set<string>();
  const unique = extracted.dishes.filter((dish) => {
    const key = dish.name.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const drafts: DishDraft[] = unique.map((input, index) => {
    const traits = Object.fromEntries(TASTE_DIMENSIONS.map((key) => [key, input[key]])) as TasteFeatureVector;
    const dishId = `menu-dish-${slugify(input.name)}-${index}`;
    const dish: Omit<Dish, "embedding"> = {
      id: dishId,
      name: input.name,
      description: input.description || "No description listed on the menu.",
      category: input.category,
      cuisine: input.cuisine || "Unknown",
      ingredients: input.ingredients,
      features: {
        ...traits,
        cuisines: input.cuisine && input.cuisine !== "Unknown" ? [input.cuisine] : [],
        majorIngredients: input.ingredients,
        proteinTypes: input.proteinTypes,
        carbohydrateTypes: input.carbohydrateTypes,
        cookingMethods: input.cookingMethods,
        confidence: input.confidence,
        unknownFields: input.unknownFields,
      },
    };
    return { input, index, dish };
  });

  return { menu, drafts };
}

function finishExtractedMenu(
  menu: Menu,
  drafts: DishDraft[],
  embeddings: number[][],
  usedFallback: boolean,
  notice?: string,
): ExtractedMenu {
  const items: MenuItem[] = drafts.map(({ input, index, dish }) => {
    return {
      id: `item-${slugify(input.name)}-${index}`,
      menuId: menu.id,
      menuOrder: index,
      price: input.price,
      dish: { ...dish, embedding: embeddings[index] },
    };
  });

  return { menu, items, usedFallback, notice };
}

export function processExtractedMenu(
  extracted: ExtractedMenuModel,
  sourceType: Menu["sourceType"],
  usedFallback: boolean,
  notice?: string,
): ExtractedMenu {
  const { menu, drafts } = prepareExtractedMenu(extracted, sourceType);
  const embeddings = drafts.map(({ dish }) => deterministicEmbedding(normalizeDishText(dish)));
  return finishExtractedMenu(menu, drafts, embeddings, usedFallback, notice);
}

function storeEmbedding(cache: Map<string, number[]>, key: string, embedding: number[]) {
  if (cache === menuEmbeddingCache && cache.size >= MAX_EMBEDDING_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, embedding);
}

async function createBatchedEmbeddings(
  texts: string[],
  provider: EmbeddingProvider,
  cache: Map<string, number[]>,
) {
  const keys = texts.map((text) => `${provider.name}:${text}`);
  const cacheHitCount = keys.filter((key) => cache.has(key)).length;
  const missing = new Map<string, string>();
  keys.forEach((key, index) => {
    if (!cache.has(key)) missing.set(key, texts[index]);
  });

  if (missing.size > 0) {
    const missingEntries = [...missing.entries()];
    const generated = await provider.embed(missingEntries.map(([, text]) => text));
    const valid = generated.length === missingEntries.length && generated.every(
      (embedding) => embedding.length > 0 && embedding.every(Number.isFinite),
    );
    if (!valid) throw new Error("The embedding provider returned an incomplete batch.");
    missingEntries.forEach(([key], index) => storeEmbedding(cache, key, generated[index]));
  }

  return {
    embeddings: keys.map((key) => cache.get(key)!),
    generatedCount: missing.size,
    cacheHitCount,
  };
}

export async function processExtractedMenuWithEmbeddings(
  extracted: ExtractedMenuModel,
  sourceType: Menu["sourceType"],
  usedFallback: boolean,
  notice?: string,
  options: EmbeddingProcessingOptions = {},
): Promise<ExtractedMenu> {
  const { menu, drafts } = prepareExtractedMenu(extracted, sourceType);
  const texts = drafts.map(({ dish }) => normalizeDishText(dish));
  // Menu vectors must stay in the same space as the current client-side seed profile.
  // Supplying OpenAIEmbeddingProvider here later still produces one request for all misses.
  const provider = options.embeddingProvider ?? new DeterministicEmbeddingProvider();
  const cache = options.embeddingCache ?? menuEmbeddingCache;
  const started = performance.now();

  try {
    const result = await createBatchedEmbeddings(texts, provider, cache);
    if (process.env.NODE_ENV === "development") {
      console.info("[TasteDNA timing] menu embeddings", {
        provider: provider.name,
        durationMs: Math.round(performance.now() - started),
        dishes: texts.length,
        generated: result.generatedCount,
        cacheHits: result.cacheHitCount,
        batchedRequests: result.generatedCount > 0 ? 1 : 0,
      });
    }
    return finishExtractedMenu(menu, drafts, result.embeddings, usedFallback, notice);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[TasteDNA] Embedding batch failed; using deterministic embeddings", {
        provider: provider.name,
        reason: error instanceof Error ? error.name : "unknown_error",
      });
    }
    const embeddings = drafts.map(({ dish }) => deterministicEmbedding(normalizeDishText(dish)));
    return finishExtractedMenu(menu, drafts, embeddings, usedFallback, notice);
  }
}

const KEYWORD_TRAITS: Record<string, Partial<TasteFeatureVector>> = {
  chile: { spicy: .78 }, spicy: { spicy: .82 }, hot: { spicy: .7 },
  honey: { sweet: .75 }, caramel: { sweet: .76, rich: .55 }, chocolate: { sweet: .75, bitter: .26, rich: .78 },
  lemon: { sour: .7, fresh: .55 }, lime: { sour: .72, fresh: .6 }, pickle: { sour: .65, salty: .45 },
  parmesan: { salty: .62, umami: .7, rich: .5 }, mushroom: { umami: .78 }, miso: { salty: .58, umami: .84 },
  fried: { crispy: .82, rich: .64 }, crispy: { crispy: .9 }, grilled: { smoky: .6 }, charred: { smoky: .78 },
  cream: { creamy: .85, rich: .75 }, butter: { rich: .78, creamy: .45 }, avocado: { creamy: .65, fresh: .5 },
  salad: { fresh: .84, crispy: .45 }, herb: { fresh: .7 }, noodle: { chewy: .58 }, dumpling: { chewy: .58 },
};

const PROTEINS = ["chicken", "beef", "pork", "lamb", "salmon", "tuna", "shrimp", "tofu", "egg"];
const CARBS = ["rice", "noodle", "pasta", "bread", "potato", "tortilla", "grits"];
const METHODS = ["fried", "grilled", "roasted", "braised", "steamed", "baked", "raw", "poached"];

function inferDish(name: string, description: string, price?: number, category = "Unknown"): ExtractedDishInput {
  const text = `${name} ${description}`.toLowerCase();
  const traits = Object.fromEntries(TASTE_DIMENSIONS.map((key) => [key, .16])) as TasteFeatureVector;
  for (const [keyword, values] of Object.entries(KEYWORD_TRAITS)) {
    if (!text.includes(keyword)) continue;
    for (const [key, value] of Object.entries(values)) {
      traits[key as keyof TasteFeatureVector] = Math.max(traits[key as keyof TasteFeatureVector], value ?? 0);
    }
  }
  const tokens = text.match(/[a-z]+/g) ?? [];
  const ingredients = [...new Set(tokens.filter((token) => [...PROTEINS, ...CARBS, "mushroom", "cheese", "tomato", "chile", "herb", "avocado"].includes(token)))];
  return {
    name,
    description,
    price: price ?? null,
    category,
    cuisine: "Unknown",
    ingredients,
    ...traits,
    proteinTypes: PROTEINS.filter((value) => text.includes(value)),
    carbohydrateTypes: CARBS.filter((value) => text.includes(value)),
    cookingMethods: METHODS.filter((value) => text.includes(value)),
    confidence: .48,
    unknownFields: ["cuisine", ...(ingredients.length ? [] : ["ingredients"])],
  };
}

export function parsePastedMenu(text: string): ExtractedMenuModel {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 100);
  const pricePattern = /(?:\$|USD\s*)?(\d{1,3}(?:\.\d{2})?)\s*$/i;
  const dishes: ExtractedDishInput[] = [];
  let category = "Unknown";

  for (const line of lines) {
    const section = line.match(/^(menu|starters?|appetizers?|small plates?|mains?|entrées?|sides?|salads?|desserts?|drinks?|beverages?)\s*:?$/i);
    if (section) {
      category = section[1];
      continue;
    }
    const priceMatch = line.match(pricePattern);
    const price = priceMatch ? Number(priceMatch[1]) : undefined;
    const clean = priceMatch ? line.slice(0, priceMatch.index).replace(/[.·\-–—\s]+$/, "").trim() : line;
    const [rawName, ...descriptionParts] = clean.split(/\s+(?:-|–|—|\|)\s+/);
    if (rawName.length < 2) continue;
    dishes.push(inferDish(rawName, descriptionParts.join(" "), price, category));
  }

  return { restaurantName: null, currency: "USD", dishes };
}
