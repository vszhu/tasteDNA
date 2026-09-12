export const TASTE_DIMENSIONS = [
  "sweet",
  "salty",
  "sour",
  "bitter",
  "umami",
  "spicy",
  "rich",
  "fresh",
  "crispy",
  "creamy",
  "chewy",
  "smoky",
] as const;

export type TasteDimension = (typeof TASTE_DIMENSIONS)[number];
export type TasteFeatureVector = Record<TasteDimension, number>;

export interface DishFeatures extends TasteFeatureVector {
  cuisines: string[];
  majorIngredients: string[];
  proteinTypes: string[];
  carbohydrateTypes: string[];
  cookingMethods: string[];
  confidence?: number;
  unknownFields?: string[];
}

export interface Dish {
  id: string;
  name: string;
  description: string;
  category?: string;
  cuisine: string;
  ingredients: string[];
  features: DishFeatures;
  embedding: number[];
  imageHint?: string;
}

export interface User {
  id: string;
  email?: string;
  displayName?: string;
  createdAt: string;
}

export interface Rating {
  id: string;
  userId: string;
  dishId: string;
  value: 1 | 2 | 3 | 4 | 5;
  source: "onboarding" | "feedback";
  createdAt: string;
}

export interface TasteProfile {
  id: string;
  userId: string;
  semanticVector: number[];
  attributePreferences: TasteFeatureVector;
  cuisinePreferences: Record<string, number>;
  cookingMethodPreferences: Record<string, number>;
  favoriteCuisines: string[];
  strongestPositiveFlavors: TasteDimension[];
  strongestNegativeFlavors: TasteDimension[];
  favoriteTextures: TasteDimension[];
  preferredCookingStyles: string[];
  representativeDishIds: string[];
  ratingCount: number;
  confidence: "early read" | "taking shape" | "well defined";
  updatedAt: string;
}

export interface Menu {
  id: string;
  restaurantName?: string;
  sourceType: "image" | "text" | "demo";
  currency: string;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  menuId: string;
  menuOrder: number;
  price?: number | null;
  dish: Dish;
}

export interface Recommendation {
  id: string;
  menuItemId: string;
  dish: Dish;
  price?: number | null;
  menuOrder: number;
  score: number;
  semanticScore: number;
  structuredScore: number;
  positiveFactors: string[];
  negativeFactors: string[];
  explanation: string;
  rank: number;
}

export interface ExtractedMenu {
  menu: Menu;
  items: MenuItem[];
  usedFallback: boolean;
  notice?: string;
}
