import { processExtractedMenu } from "@/lib/menu/process";
import { SAMPLE_MENU_MODEL } from "@/lib/menu/sample";

/** Separate sample: never edits the user's medication list or taste ratings. */
export function createMedicationDemoMenu() {
  return processExtractedMenu({
    ...SAMPLE_MENU_MODEL,
    restaurantName: "Juniper & Ember · example menu",
    dishes: [
      ...SAMPLE_MENU_MODEL.dishes,
      {
        ...SAMPLE_MENU_MODEL.dishes[3], name: "Pink Grapefruit Spritz",
        description: "Grapefruit juice, sparkling water and rosemary. Alcohol-free.",
        ingredients: ["grapefruit juice", "sparkling water", "rosemary"],
        category: "Drinks", price: 7, proteinTypes: [], cookingMethods: [],
      },
      {
        ...SAMPLE_MENU_MODEL.dishes[3], name: "Orange & Apple Cooler",
        description: "Orange juice, apple juice and sparkling water.",
        ingredients: ["orange juice", "apple juice", "sparkling water"],
        category: "Drinks", price: 6, proteinTypes: [], cookingMethods: [],
      },
    ],
  }, "demo", true, "Example menu for exploring medication checks. These are sample dishes, not a verified restaurant menu.");
}
