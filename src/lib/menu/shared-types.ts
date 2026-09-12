import type { MenuItem } from "@/types";

export interface SharedMenuItemPayload {
  menuOrder: number;
  price: number | null;
  category: string | null;
  dish: {
    name: string;
    description: string;
    cuisine: string;
    ingredients: string[];
    normalizedEmbeddingText: string;
    embeddingModel: string;
    rankingEmbedding: number[];
    contentHash: string;
    features: {
      sweet: number;
      salty: number;
      sour: number;
      bitter: number;
      umami: number;
      spicy: number;
      rich: number;
      fresh: number;
      crispy: number;
      creamy: number;
      chewy: number;
      smoky: number;
      cuisines: string[];
      majorIngredients: string[];
      proteinTypes: string[];
      carbohydrateTypes: string[];
      cookingMethods: string[];
      confidence: number | null;
      unknownFields: string[];
    };
  };
}

export interface SharedMenuIngestionInput {
  venueId: string;
  uploadedBy: string;
  restaurantName: string | null;
  sourceType: "image" | "text";
  sourceProvider: string;
  sourceUri: string | null;
  sourceMetadata: Record<string, unknown>;
  currency: string;
  contentHash: string;
  observedAt: string;
  items: SharedMenuItemPayload[];
}

export interface SharedMenuIngestionResult {
  menuId: string;
  version: number;
  created: boolean;
}

export interface SharedVenueMenu {
  menuId: string;
  venueId: string;
  version: number;
  observedAt: string;
  validFrom: string;
  validUntil: string | null;
  freshness: "fresh" | "stale";
  items: MenuItem[];
}

export interface SharedMenuRepository {
  ingest(input: SharedMenuIngestionInput): Promise<SharedMenuIngestionResult>;
  listNewestValidForVenues(venueIds: string[], now?: Date): Promise<Map<string, SharedVenueMenu>>;
}
