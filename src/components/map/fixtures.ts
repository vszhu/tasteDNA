import { TASTE_DIMENSIONS } from "@/types";
import type { Dish, DishFeatures, MenuItem, TasteFeatureVector } from "@/types";
import type { Venue } from "@/types/group";

/**
 * Demo fallback venues, shown when `/api/venues` has no venue with a
 * digitized menu yet (the CMU dish-tagging pipeline is still catching up —
 * every real venue currently comes back with an empty `menuItems` array).
 * Names/locations/coordinates are the real CMU dining venues; the dishes are
 * illustrative stand-ins so the candidate picker and group room are usable
 * today. This file naturally stops being used once real menus land.
 */

function features(overrides: Partial<TasteFeatureVector> = {}, extra: Partial<Omit<DishFeatures, keyof TasteFeatureVector>> = {}): DishFeatures {
  const base = Object.fromEntries(TASTE_DIMENSIONS.map((dimension) => [dimension, 0.2])) as TasteFeatureVector;
  return {
    ...base,
    ...overrides,
    cuisines: [],
    majorIngredients: [],
    proteinTypes: [],
    carbohydrateTypes: [],
    cookingMethods: [],
    ...extra,
  };
}

let dishCounter = 0;
function dish(name: string, description: string, cuisine: string, ingredients: string[], overrides: Partial<TasteFeatureVector>, extra: Partial<Omit<DishFeatures, keyof TasteFeatureVector>> = {}): Dish {
  dishCounter += 1;
  return {
    id: `fixture-dish-${dishCounter}`,
    name,
    description,
    cuisine,
    ingredients,
    features: features(overrides, extra),
    embedding: [overrides.spicy ?? 0, overrides.rich ?? 0, overrides.fresh ?? 0],
  };
}

function menuItems(menuId: string, entries: Array<{ dish: Dish; price: number }>): MenuItem[] {
  return entries.map((entry, index): MenuItem => ({ id: `${menuId}-item-${index}`, menuId, menuOrder: index, price: entry.price, dish: entry.dish }));
}

export const VENUE_FIXTURES: Venue[] = [
  {
    id: "the-exchange",
    name: "The Exchange",
    description: "Deli and breakfast sandwiches, daily hot entrées, grab-and-go.",
    location: { label: "Posner Hall, 1st Floor", latitude: 40.441354, longitude: -79.942125 },
    acceptsOnlineOrders: false,
    menuFreshness: "fresh",
    menuItems: menuItems("menu-exchange", [
      { dish: dish("Turkey Club Sandwich", "Roast turkey, bacon, lettuce, tomato on sourdough.", "American", ["turkey", "bacon", "sourdough"], { rich: 0.5, umami: 0.5 }, { proteinTypes: ["turkey", "bacon"] }), price: 9.5 },
      { dish: dish("Seafood Chowder", "Creamy chowder with shrimp and scallops.", "American", ["shrimp", "scallops", "cream"], { rich: 0.8, creamy: 0.8, umami: 0.6 }, { proteinTypes: ["shrimp", "scallops"] }), price: 6 },
    ]),
  },
  {
    id: "schatz-dining-room",
    name: "Schatz Dining Room",
    description: "All-you-care-to-eat residential dining hall.",
    location: { label: "Cohon Center, 2nd Floor", latitude: 40.4430865629653, longitude: -79.94254227553057 },
    acceptsOnlineOrders: false,
    menuFreshness: "fresh",
    menuItems: menuItems("menu-schatz", [
      { dish: dish("Grilled Chicken Bowl", "Grilled chicken, rice, roasted vegetables.", "American", ["chicken", "rice", "broccoli"], { umami: 0.5, fresh: 0.5 }, { proteinTypes: ["chicken"] }), price: 8 },
      { dish: dish("Vegetable Stir-Fry", "Seasonal vegetables tossed in a light soy glaze.", "Asian", ["broccoli", "carrot", "soy sauce"], { fresh: 0.7, salty: 0.4 }, { proteinTypes: ["tofu"] }), price: 7 },
    ]),
  },
  {
    id: "taste-of-india",
    name: "Taste of India",
    description: "Aromatic spices, rich curries, and tandoori specialties.",
    location: { label: "Resnik House, Resnik Servery", latitude: 40.44253705946464, longitude: -79.9400539411368 },
    acceptsOnlineOrders: true,
    menuFreshness: "stale",
    menuItems: menuItems("menu-toi", [
      { dish: dish("Chicken Tikka Masala", "Tandoori chicken in a spiced tomato-cream sauce.", "Indian", ["chicken", "tomato", "cream"], { spicy: 0.6, rich: 0.7, umami: 0.6 }, { proteinTypes: ["chicken"] }), price: 10 },
      { dish: dish("Chana Masala", "Chickpeas simmered in a spiced tomato gravy.", "Indian", ["chickpeas", "tomato"], { spicy: 0.6, umami: 0.5 }, { proteinTypes: ["chickpeas"] }), price: 8.5 },
    ]),
  },
  {
    id: "wild-blue-sushi",
    name: "Wild Blue Sushi",
    description: "Fresh prepared sushi, hot rice bowls, bubble tea and coffee.",
    location: { label: "Scott Hall, Lower Level", latitude: 40.44269873724883, longitude: -79.94664155857618 },
    acceptsOnlineOrders: true,
    menuFreshness: "fresh",
    menuItems: menuItems("menu-wbs", [
      { dish: dish("Spicy Tuna Roll", "Tuna, spicy mayo, cucumber, nori.", "Japanese", ["tuna", "cucumber", "nori"], { spicy: 0.6, fresh: 0.6, umami: 0.5 }, { proteinTypes: ["tuna"] }), price: 8 },
      { dish: dish("Salmon Poke Bowl", "Salmon, rice, avocado, edamame, sesame.", "Japanese", ["salmon", "avocado", "edamame"], { fresh: 0.8, umami: 0.5 }, { proteinTypes: ["salmon"] }), price: 11 },
    ]),
  },
  {
    id: "hunan-express",
    name: "Hunan Express",
    description: "Asian cuisine, rice bowls, boba and smoothies.",
    location: { label: "Newell-Simon Atrium", latitude: 40.443392, longitude: -79.945596 },
    acceptsOnlineOrders: true,
    menuFreshness: "fresh",
    menuItems: menuItems("menu-hunan", [
      { dish: dish("Kung Pao Chicken", "Wok-fried chicken, peanuts, dried chiles.", "Chinese", ["chicken", "peanuts", "chile"], { spicy: 0.7, umami: 0.5 }, { proteinTypes: ["chicken", "peanuts"] }), price: 9 },
      { dish: dish("Beef and Broccoli", "Sliced beef and broccoli in a savory sauce.", "Chinese", ["beef", "broccoli"], { umami: 0.6, rich: 0.4 }, { proteinTypes: ["beef"] }), price: 9.5 },
    ]),
  },
  {
    id: "la-prima-rohr-cafe",
    name: "La Prima - Rohr Café",
    description: "Italian-style coffee and food, sandwiches and pastries.",
    location: { label: "Gates Hillman Centers, 3rd Floor", latitude: 40.44347617300122, longitude: -79.94480928001676 },
    acceptsOnlineOrders: false,
    menuFreshness: "unknown",
    menuItems: [],
  },
];

export const CMU_CAMPUS_CENTER: [number, number] = [40.4443, -79.9436];
