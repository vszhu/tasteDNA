/**
 * Published components, visually checked against both pages on 2026-09-12.
 * Source is CMU's Fall 2025 Capital Grains menu, not a current kitchen audit.
 * Dressing/formulation details and preparation changes are not supplied.
 * The default Return On Ingredients includes avocado; the PDF offers replacing
 * it to avoid a surcharge. That customization is not assumed here.
 * "Picked red onions" on that card is normalized to "pickled red onions",
 * matching the menu's other cards and the build-your-own component list.
 * No components are assigned to Build Your Own Bowl before choices are known.
 */
const sourceUri = "https://apps.studentaffairs.cmu.edu/dining/dashboard_images/Production/menus/179/Capital Grains Menu F25.pdf";

export const CMU_CAPITAL_GRAINS_COMPONENTS = [
  {
    datasetId: 179,
    sourceUri,
    dishName: "Seed Funding",
    ingredients: ["rice", "quinoa", "pickled red onions", "cucumbers", "corn", "chickpeas", "baked chicken", "cilantro lime dressing"],
  },
  {
    datasetId: 179,
    sourceUri,
    dishName: "Return On Ingredients",
    ingredients: ["rice", "quinoa", "pickled red onions", "corn", "grape tomatoes", "avocado", "baked chicken", "chipotle ranch dressing"],
  },
  {
    datasetId: 179,
    sourceUri,
    dishName: "Greek Options",
    ingredients: ["rice", "quinoa", "grape tomatoes", "chickpeas", "pita chips", "feta cheese", "baked chicken", "pesto vinaigrette"],
  },
  {
    datasetId: 179,
    sourceUri,
    dishName: "Capital Greens",
    ingredients: ["romaine", "pickled red onions", "grape tomatoes", "pita chips", "asiago cheese", "baked chicken", "pesto vinaigrette"],
  },
  {
    datasetId: 179,
    sourceUri,
    dishName: "Market Mix",
    ingredients: ["spinach", "arugula", "Brussels sprouts", "corn", "carrots", "cucumbers", "baked tofu", "Asian sesame dressing"],
  },
] as const;
