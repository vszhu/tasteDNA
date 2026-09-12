import { createHash } from "node:crypto";
import { normalizeDishText } from "@/lib/embeddings/normalize";
import { TASTE_DIMENSIONS, type ExtractedMenu } from "@/types";
import type { SharedMenuIngestionInput, SharedMenuItemPayload } from "./shared-types";

function normalizedText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function canonicalText(value: string) {
  return normalizedText(value).toLocaleLowerCase("en-US");
}

function canonicalStrings(values: string[]) {
  return [...new Set(values.map(canonicalText).filter(Boolean))].sort();
}

function finiteNumber(value: number) {
  return Number(value.toFixed(6));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function itemPayload(item: ExtractedMenu["items"][number]): SharedMenuItemPayload {
  const dish = item.dish;
  const featureNumbers = Object.fromEntries(
    TASTE_DIMENSIONS.map((dimension) => [dimension, finiteNumber(dish.features[dimension])]),
  ) as Record<(typeof TASTE_DIMENSIONS)[number], number>;
  const canonicalDish = {
    name: canonicalText(dish.name),
    description: canonicalText(dish.description),
    cuisine: canonicalText(dish.cuisine),
    ingredients: canonicalStrings(dish.ingredients),
    category: canonicalText(dish.category ?? ""),
    price: item.price ?? null,
    features: {
      ...featureNumbers,
      cuisines: canonicalStrings(dish.features.cuisines),
      majorIngredients: canonicalStrings(dish.features.majorIngredients),
      proteinTypes: canonicalStrings(dish.features.proteinTypes),
      carbohydrateTypes: canonicalStrings(dish.features.carbohydrateTypes),
      cookingMethods: canonicalStrings(dish.features.cookingMethods),
      confidence: dish.features.confidence === undefined
        ? null
        : finiteNumber(dish.features.confidence),
      unknownFields: canonicalStrings(dish.features.unknownFields ?? []),
    },
  };

  return {
    menuOrder: item.menuOrder,
    price: item.price ?? null,
    category: dish.category ? normalizedText(dish.category) : null,
    dish: {
      name: normalizedText(dish.name),
      description: normalizedText(dish.description),
      cuisine: normalizedText(dish.cuisine),
      ingredients: dish.ingredients.map(normalizedText),
      normalizedEmbeddingText: normalizeDishText(dish),
      embeddingModel: "deterministic-local-v1",
      rankingEmbedding: dish.embedding.map(finiteNumber),
      contentHash: sha256(canonicalDish),
      features: {
        ...featureNumbers,
        cuisines: dish.features.cuisines.map(normalizedText),
        majorIngredients: dish.features.majorIngredients.map(normalizedText),
        proteinTypes: dish.features.proteinTypes.map(normalizedText),
        carbohydrateTypes: dish.features.carbohydrateTypes.map(normalizedText),
        cookingMethods: dish.features.cookingMethods.map(normalizedText),
        confidence: dish.features.confidence ?? null,
        unknownFields: dish.features.unknownFields?.map(normalizedText) ?? [],
      },
    },
  };
}

export function buildSharedMenuIngestion(
  menu: ExtractedMenu,
  input: Omit<SharedMenuIngestionInput, "restaurantName" | "currency" | "contentHash" | "items">,
): SharedMenuIngestionInput {
  const items = menu.items.map(itemPayload).sort((left, right) => left.menuOrder - right.menuOrder);
  const identity = {
    restaurantName: canonicalText(menu.menu.restaurantName ?? ""),
    currency: menu.menu.currency.toUpperCase(),
    items: items.map((item) => ({
      menuOrder: item.menuOrder,
      price: item.price,
      category: canonicalText(item.category ?? ""),
      dishContentHash: item.dish.contentHash,
    })),
  };

  return {
    ...input,
    restaurantName: menu.menu.restaurantName ?? null,
    currency: menu.menu.currency.toUpperCase(),
    contentHash: sha256(identity),
    items,
  };
}

export const sharedMenuContentHash = sha256;
