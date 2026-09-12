/**
 * Checked 2026-09-12 against both rendered pages of CMU's linked K-Station PDF.
 * These are printed dish components, not exhaustive recipes. Sauces and
 * dumpling fillings are not expanded into guessed subingredients. The menu
 * is undated and the truck's dishes can rotate; confirm current preparation.
 *
 * K-Station is dataset 206. Its PDF remains under the legacy /menus/168 path.
 * The generic bowl header explicitly includes rice, chicken dumplings, and
 * lettuce salad. We omit Tofu Bowl because its vegetarian marker conflicts
 * with the chicken-dumpling side; we do not resolve that ambiguity by guessing.
 * Korean Corn Dog has selectable fillings/sides/crusts, so it is also omitted.
 *
 * Hunan's current PDF provides names and choices but no separate component
 * descriptions. Forbes' F25 PDF replaces the old dataset's signature subs;
 * no historical Forbes recipe is represented here as current evidence.
 */
const K_STATION_SOURCE = "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/168/Tartan Express Menus (22 x 28 in) (8.5 x 11 in) (1).pdf";

export const CMU_ADDITIONAL_PUBLISHED_COMPONENTS: {
  datasetId: number;
  sourceUri: string;
  dishName: string;
  ingredients: string[];
}[] = [
  {
    datasetId: 206,
    sourceUri: K_STATION_SOURCE,
    dishName: "Bulgogi Bowl",
    ingredients: ["steamed rice", "chicken dumplings", "lettuce salad", "beef", "bulgogi sauce"],
  },
  {
    datasetId: 206,
    sourceUri: K_STATION_SOURCE,
    dishName: "Spicy Pork Bowl",
    ingredients: ["steamed rice", "chicken dumplings", "lettuce salad", "pork", "gochujang-based sauce"],
  },
  {
    datasetId: 206,
    sourceUri: K_STATION_SOURCE,
    dishName: "Chicken Bowl",
    ingredients: ["steamed rice", "chicken dumplings", "lettuce salad", "chicken", "curry-based sauce"],
  },
  {
    datasetId: 206,
    sourceUri: K_STATION_SOURCE,
    dishName: "Mandoo (Chicken)",
    ingredients: ["chicken dumplings", "Yum sauce"],
  },
  {
    datasetId: 206,
    sourceUri: K_STATION_SOURCE,
    dishName: "Kimchi",
    ingredients: ["fermented napa cabbage", "red pepper"],
  },
  {
    datasetId: 206,
    sourceUri: K_STATION_SOURCE,
    dishName: "Hotteok",
    ingredients: ["brown sugar", "peanut dough"],
  },
];
