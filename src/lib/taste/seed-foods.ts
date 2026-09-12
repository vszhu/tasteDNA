import type { Dish, DishFeatures, TasteFeatureVector } from "@/types";
import { TASTE_DIMENSIONS } from "@/types";
import { deterministicEmbedding } from "@/lib/embeddings/deterministic";
import { normalizeDishText } from "@/lib/embeddings/normalize";

interface SeedDish {
  name: string;
  description: string;
  cuisine: string;
  ingredients: string[];
  traits: Partial<TasteFeatureVector>;
  proteins?: string[];
  carbs?: string[];
  methods?: string[];
  imageHint?: string;
}

const DEFAULT_TRAIT = 0.12;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function makeDish(seed: SeedDish): Dish {
  const numeric = Object.fromEntries(
    TASTE_DIMENSIONS.map((dimension) => [dimension, seed.traits[dimension] ?? DEFAULT_TRAIT]),
  ) as TasteFeatureVector;
  const features: DishFeatures = {
    ...numeric,
    cuisines: [seed.cuisine],
    majorIngredients: seed.ingredients,
    proteinTypes: seed.proteins ?? [],
    carbohydrateTypes: seed.carbs ?? [],
    cookingMethods: seed.methods ?? [],
    confidence: 1,
  };
  const withoutEmbedding: Omit<Dish, "embedding"> = {
    id: `seed-${slugify(seed.name)}`,
    name: seed.name,
    description: seed.description,
    cuisine: seed.cuisine,
    ingredients: seed.ingredients,
    features,
    imageHint: seed.imageHint,
  };
  return { ...withoutEmbedding, embedding: deterministicEmbedding(normalizeDishText(withoutEmbedding)) };
}

const seeds: SeedDish[] = [
  { name: "Margherita Pizza", description: "Charred crust, tomato, mozzarella and basil.", cuisine: "Italian", ingredients: ["tomato", "mozzarella", "basil"], traits: { salty: .55, umami: .62, rich: .5, chewy: .58, smoky: .3 }, proteins: ["dairy"], carbs: ["wheat"], methods: ["wood-fired", "baked"], imageHint: "🍕" },
  { name: "Spicy Tuna Roll", description: "Tuna, seasoned rice, nori and chile mayo.", cuisine: "Japanese", ingredients: ["tuna", "rice", "nori", "chile mayo"], traits: { salty: .55, umami: .72, spicy: .7, creamy: .35, fresh: .48 }, proteins: ["fish"], carbs: ["rice"], methods: ["raw", "rolled"], imageHint: "🍣" },
  { name: "Tonkotsu Ramen", description: "Silky pork broth, noodles, egg and scallion.", cuisine: "Japanese", ingredients: ["pork", "noodles", "egg", "scallion"], traits: { salty: .68, umami: .92, rich: .9, creamy: .66, chewy: .6 }, proteins: ["pork", "egg"], carbs: ["noodles"], methods: ["simmered"], imageHint: "🍜" },
  { name: "Tacos al Pastor", description: "Chile-marinated pork, pineapple, onion and cilantro.", cuisine: "Mexican", ingredients: ["pork", "pineapple", "onion", "cilantro"], traits: { sweet: .4, salty: .48, sour: .42, umami: .68, spicy: .64, smoky: .65, fresh: .5 }, proteins: ["pork"], carbs: ["corn tortilla"], methods: ["roasted", "grilled"], imageHint: "🌮" },
  { name: "Green Thai Curry", description: "Coconut curry with herbs, vegetables and jasmine rice.", cuisine: "Thai", ingredients: ["coconut", "green chile", "Thai basil", "vegetables"], traits: { sweet: .34, salty: .4, sour: .32, umami: .6, spicy: .78, rich: .68, creamy: .72, fresh: .5 }, proteins: ["vegetable"], carbs: ["rice"], methods: ["simmered"], imageHint: "🍛" },
  { name: "Butter Chicken", description: "Tandoori chicken in a creamy tomato-spice sauce.", cuisine: "Indian", ingredients: ["chicken", "tomato", "butter", "garam masala"], traits: { sweet: .28, salty: .48, umami: .7, spicy: .5, rich: .9, creamy: .86, smoky: .34 }, proteins: ["chicken"], carbs: ["rice"], methods: ["tandoori", "simmered"], imageHint: "🍛" },
  { name: "Smash Burger", description: "Crisp-edged beef patty, cheddar, pickles and sauce.", cuisine: "American", ingredients: ["beef", "cheddar", "pickle", "onion"], traits: { salty: .72, sour: .28, umami: .82, rich: .86, crispy: .55, smoky: .4 }, proteins: ["beef", "dairy"], carbs: ["bun"], methods: ["griddled"], imageHint: "🍔" },
  { name: "Caesar Salad", description: "Romaine, parmesan, croutons and anchovy dressing.", cuisine: "American", ingredients: ["romaine", "parmesan", "anchovy", "croutons"], traits: { salty: .68, sour: .35, umami: .7, fresh: .78, crispy: .65, creamy: .45 }, proteins: ["fish", "dairy"], carbs: ["bread"], methods: ["raw"], imageHint: "🥗" },
  { name: "Salmon Poke", description: "Raw salmon, rice, edamame, cucumber and sesame.", cuisine: "Hawaiian", ingredients: ["salmon", "rice", "edamame", "cucumber"], traits: { salty: .48, umami: .68, rich: .38, fresh: .85, creamy: .25, chewy: .3 }, proteins: ["fish"], carbs: ["rice"], methods: ["raw"], imageHint: "🥢" },
  { name: "Xiao Long Bao", description: "Delicate steamed pork soup dumplings.", cuisine: "Chinese", ingredients: ["pork", "ginger", "wheat wrapper", "broth"], traits: { salty: .5, umami: .8, rich: .62, chewy: .6 }, proteins: ["pork"], carbs: ["wheat"], methods: ["steamed"], imageHint: "🥟" },
  { name: "Beef Bibimbap", description: "Rice, marinated beef, vegetables, egg and gochujang.", cuisine: "Korean", ingredients: ["beef", "rice", "egg", "gochujang", "vegetables"], traits: { salty: .5, sour: .22, umami: .82, spicy: .58, fresh: .46, crispy: .44 }, proteins: ["beef", "egg"], carbs: ["rice"], methods: ["griddled", "mixed"], imageHint: "🍲" },
  { name: "Baked Mac and Cheese", description: "Creamy cheddar pasta with a browned crumb top.", cuisine: "American", ingredients: ["pasta", "cheddar", "milk", "breadcrumbs"], traits: { salty: .6, umami: .55, rich: .94, crispy: .38, creamy: .94, chewy: .42 }, proteins: ["dairy"], carbs: ["pasta"], methods: ["baked"], imageHint: "🧀" },
  { name: "Falafel Pita", description: "Herbed chickpea fritters, tahini, tomato and pickles.", cuisine: "Levantine", ingredients: ["chickpea", "tahini", "tomato", "pickle"], traits: { salty: .42, sour: .38, rich: .35, fresh: .65, crispy: .78, creamy: .34 }, proteins: ["legume"], carbs: ["pita"], methods: ["fried"], imageHint: "🧆" },
  { name: "Pad Thai", description: "Tamarind rice noodles with egg, peanuts and bean sprouts.", cuisine: "Thai", ingredients: ["rice noodles", "tamarind", "egg", "peanut"], traits: { sweet: .55, salty: .48, sour: .62, umami: .52, spicy: .3, fresh: .35, chewy: .62 }, proteins: ["egg", "peanut"], carbs: ["rice noodles"], methods: ["stir-fried"], imageHint: "🍜" },
  { name: "Carnitas Burrito", description: "Slow-cooked pork, beans, rice, salsa and crema.", cuisine: "Mexican", ingredients: ["pork", "beans", "rice", "salsa"], traits: { salty: .58, sour: .28, umami: .68, spicy: .38, rich: .72, creamy: .32 }, proteins: ["pork", "legume"], carbs: ["rice", "flour tortilla"], methods: ["braised"], imageHint: "🌯" },
  { name: "Grilled Ribeye", description: "Rich marbled steak with garlic herb butter.", cuisine: "Steakhouse", ingredients: ["beef", "garlic", "butter"], traits: { salty: .62, umami: .9, rich: .94, smoky: .72, chewy: .38 }, proteins: ["beef"], methods: ["grilled"], imageHint: "🥩" },
  { name: "Yangzhou Fried Rice", description: "Wok-fried rice with egg, shrimp, peas and scallion.", cuisine: "Chinese", ingredients: ["rice", "egg", "shrimp", "peas"], traits: { salty: .5, umami: .7, rich: .42, fresh: .22, smoky: .35 }, proteins: ["shrimp", "egg"], carbs: ["rice"], methods: ["wok-fried"], imageHint: "🍚" },
  { name: "Cacio e Pepe", description: "Pasta glossed with pecorino and black pepper.", cuisine: "Italian", ingredients: ["pasta", "pecorino", "black pepper"], traits: { salty: .72, umami: .72, spicy: .2, rich: .78, creamy: .65, chewy: .54 }, proteins: ["dairy"], carbs: ["pasta"], methods: ["boiled", "emulsified"], imageHint: "🍝" },
  { name: "Beef Pho", description: "Aromatic broth, rice noodles, sliced beef and fresh herbs.", cuisine: "Vietnamese", ingredients: ["beef", "rice noodles", "herbs", "lime"], traits: { salty: .46, sour: .3, umami: .82, rich: .34, fresh: .76, chewy: .48 }, proteins: ["beef"], carbs: ["rice noodles"], methods: ["simmered"], imageHint: "🍜" },
  { name: "Grilled Cheese", description: "Buttery toasted bread with molten sharp cheddar.", cuisine: "American", ingredients: ["bread", "cheddar", "butter"], traits: { salty: .58, umami: .52, rich: .84, crispy: .72, creamy: .75, chewy: .42 }, proteins: ["dairy"], carbs: ["bread"], methods: ["griddled"], imageHint: "🥪" },
  { name: "Texas Chili", description: "Slow-simmered beef, dried chiles and warm spices.", cuisine: "Tex-Mex", ingredients: ["beef", "dried chile", "tomato", "cumin"], traits: { salty: .48, umami: .78, spicy: .72, rich: .7, smoky: .62 }, proteins: ["beef"], methods: ["slow-cooked"], imageHint: "🥘" },
  { name: "Mushroom Risotto", description: "Creamy arborio rice with mushrooms and parmesan.", cuisine: "Italian", ingredients: ["arborio rice", "mushroom", "parmesan"], traits: { salty: .45, umami: .86, rich: .78, creamy: .9, chewy: .25 }, proteins: ["dairy"], carbs: ["rice"], methods: ["slow-cooked"], imageHint: "🍚" },
  { name: "Vanilla Bean Ice Cream", description: "Cold, sweet vanilla custard.", cuisine: "American", ingredients: ["cream", "vanilla", "sugar"], traits: { sweet: .92, rich: .78, creamy: .98, fresh: .15 }, proteins: ["dairy"], methods: ["churned", "frozen"], imageHint: "🍨" },
  { name: "Basque Cheesecake", description: "Burnished cheesecake with a soft custardy center.", cuisine: "Spanish", ingredients: ["cream cheese", "egg", "sugar"], traits: { sweet: .72, salty: .22, bitter: .16, rich: .96, creamy: .94, smoky: .2 }, proteins: ["dairy", "egg"], carbs: ["sugar"], methods: ["baked"], imageHint: "🍰" },
  { name: "Fudge Brownie", description: "Dense dark chocolate brownie with crisp edges.", cuisine: "American", ingredients: ["dark chocolate", "butter", "sugar"], traits: { sweet: .85, bitter: .34, rich: .95, crispy: .25, chewy: .62 }, proteins: ["egg", "dairy"], carbs: ["wheat"], methods: ["baked"], imageHint: "🍫" },
  { name: "Mango Sorbet", description: "Bright frozen mango with lime.", cuisine: "French", ingredients: ["mango", "lime", "sugar"], traits: { sweet: .78, sour: .5, fresh: .9, creamy: .3 }, carbs: ["fruit"], methods: ["frozen"], imageHint: "🥭" },
  { name: "Doro Wat", description: "Ethiopian berbere chicken stew with egg and injera.", cuisine: "Ethiopian", ingredients: ["chicken", "berbere", "egg", "onion"], traits: { salty: .45, sour: .24, umami: .75, spicy: .8, rich: .72, smoky: .35 }, proteins: ["chicken", "egg"], carbs: ["injera"], methods: ["stewed"], imageHint: "🍲" },
  { name: "Peruvian Ceviche", description: "Citrus-cured fish, red onion, chile and cilantro.", cuisine: "Peruvian", ingredients: ["white fish", "lime", "red onion", "chile"], traits: { salty: .38, sour: .95, umami: .42, spicy: .42, fresh: .98 }, proteins: ["fish"], methods: ["citrus-cured", "raw"], imageHint: "🐟" },
  { name: "Jollof Rice", description: "Tomato-pepper rice with deep savory spice.", cuisine: "West African", ingredients: ["rice", "tomato", "pepper", "onion"], traits: { sweet: .2, salty: .4, umami: .68, spicy: .55, smoky: .6 }, carbs: ["rice"], methods: ["one-pot", "simmered"], imageHint: "🍚" },
  { name: "Lamb Tagine", description: "Slow-braised lamb with apricot, almond and warm spice.", cuisine: "Moroccan", ingredients: ["lamb", "apricot", "almond", "cinnamon"], traits: { sweet: .52, salty: .38, umami: .62, rich: .74, chewy: .36 }, proteins: ["lamb"], carbs: ["fruit"], methods: ["braised"], imageHint: "🥘" },
  { name: "Bánh Mì", description: "Crisp baguette with pork, pâté, pickles and herbs.", cuisine: "Vietnamese", ingredients: ["pork", "baguette", "pickle", "cilantro"], traits: { salty: .52, sour: .48, umami: .7, rich: .45, fresh: .62, crispy: .78 }, proteins: ["pork"], carbs: ["bread"], methods: ["roasted", "pickled"], imageHint: "🥖" },
  { name: "Korean Fried Chicken", description: "Extra-crisp chicken glazed with sweet-spicy gochujang.", cuisine: "Korean", ingredients: ["chicken", "gochujang", "garlic"], traits: { sweet: .48, salty: .56, umami: .68, spicy: .72, rich: .7, crispy: .95 }, proteins: ["chicken"], carbs: ["batter"], methods: ["fried"], imageHint: "🍗" },
  { name: "Spanakopita", description: "Flaky phyllo filled with spinach, feta and herbs.", cuisine: "Greek", ingredients: ["spinach", "feta", "phyllo"], traits: { salty: .62, sour: .22, rich: .48, fresh: .45, crispy: .9, creamy: .3 }, proteins: ["dairy"], carbs: ["phyllo"], methods: ["baked"], imageHint: "🥧" },
  { name: "Shakshuka", description: "Eggs poached in spiced tomato and pepper sauce.", cuisine: "North African", ingredients: ["egg", "tomato", "pepper", "cumin"], traits: { sweet: .2, sour: .35, umami: .62, spicy: .42, rich: .38, fresh: .4 }, proteins: ["egg"], methods: ["poached", "simmered"], imageHint: "🍳" },
  { name: "Pesto Gnocchi", description: "Tender potato dumplings with basil pesto and parmesan.", cuisine: "Italian", ingredients: ["potato", "basil", "pine nut", "parmesan"], traits: { salty: .5, umami: .62, rich: .7, fresh: .58, creamy: .42, chewy: .68 }, proteins: ["dairy"], carbs: ["potato"], methods: ["boiled"], imageHint: "🥔" },
  { name: "Jerk Chicken", description: "Charred allspice and Scotch bonnet chicken.", cuisine: "Jamaican", ingredients: ["chicken", "Scotch bonnet", "allspice", "thyme"], traits: { salty: .48, umami: .7, spicy: .92, fresh: .24, smoky: .9 }, proteins: ["chicken"], methods: ["grilled"], imageHint: "🍗" },
  { name: "French Onion Soup", description: "Caramelized onion broth under toasted bread and Gruyère.", cuisine: "French", ingredients: ["onion", "beef broth", "Gruyère", "bread"], traits: { sweet: .38, salty: .56, umami: .9, rich: .75, creamy: .35, chewy: .3 }, proteins: ["dairy"], carbs: ["bread"], methods: ["caramelized", "broiled"], imageHint: "🧅" },
  { name: "Turkish Manti", description: "Tiny beef dumplings with garlic yogurt and chile butter.", cuisine: "Turkish", ingredients: ["beef", "yogurt", "garlic", "chile"], traits: { salty: .5, sour: .4, umami: .66, spicy: .34, rich: .72, creamy: .68, chewy: .62 }, proteins: ["beef", "dairy"], carbs: ["wheat"], methods: ["boiled"], imageHint: "🥟" },
  { name: "Mapo Tofu", description: "Silken tofu and pork in a numbing chile-bean sauce.", cuisine: "Sichuan", ingredients: ["tofu", "pork", "chile bean paste", "Sichuan pepper"], traits: { salty: .58, umami: .94, spicy: .94, rich: .62, creamy: .48 }, proteins: ["tofu", "pork"], carbs: ["rice"], methods: ["braised"], imageHint: "🌶️" },
  { name: "Fattoush", description: "Herbs, crisp vegetables, sumac and toasted pita.", cuisine: "Lebanese", ingredients: ["tomato", "cucumber", "sumac", "pita"], traits: { salty: .3, sour: .72, fresh: .96, crispy: .74, bitter: .16 }, carbs: ["pita"], methods: ["raw", "toasted"], imageHint: "🥗" },
  { name: "Loco Moco", description: "Rice, hamburger patty, fried egg and mushroom gravy.", cuisine: "Hawaiian", ingredients: ["beef", "egg", "rice", "mushroom gravy"], traits: { salty: .62, umami: .86, rich: .9, creamy: .42 }, proteins: ["beef", "egg"], carbs: ["rice"], methods: ["griddled", "fried"], imageHint: "🍳" },
  { name: "Okonomiyaki", description: "Savory cabbage pancake with pork, sauce and bonito.", cuisine: "Japanese", ingredients: ["cabbage", "pork", "bonito", "flour"], traits: { sweet: .28, salty: .58, umami: .9, rich: .55, fresh: .3, crispy: .55, creamy: .28 }, proteins: ["pork", "fish"], carbs: ["wheat"], methods: ["griddled"], imageHint: "🥞" },
  { name: "Chicken Adobo", description: "Filipino chicken braised in soy, vinegar and garlic.", cuisine: "Filipino", ingredients: ["chicken", "soy", "vinegar", "garlic"], traits: { salty: .7, sour: .62, umami: .82, rich: .52 }, proteins: ["chicken"], carbs: ["rice"], methods: ["braised"], imageHint: "🍗" },
  { name: "Shrimp and Grits", description: "Creole shrimp over creamy stone-ground corn grits.", cuisine: "Southern", ingredients: ["shrimp", "corn grits", "butter", "spices"], traits: { salty: .58, umami: .72, spicy: .3, rich: .82, creamy: .88 }, proteins: ["shrimp", "dairy"], carbs: ["corn"], methods: ["sautéed", "simmered"], imageHint: "🍤" },
  { name: "Gado-Gado", description: "Vegetables, tofu and egg with rich peanut sauce.", cuisine: "Indonesian", ingredients: ["tofu", "egg", "vegetables", "peanut"], traits: { sweet: .32, salty: .45, umami: .5, spicy: .32, rich: .58, fresh: .65, creamy: .62 }, proteins: ["tofu", "egg", "peanut"], carbs: ["vegetables"], methods: ["blanched"], imageHint: "🥗" },
  { name: "Beef Empanadas", description: "Flaky baked pastry filled with spiced beef and olive.", cuisine: "Argentine", ingredients: ["beef", "onion", "olive", "pastry"], traits: { salty: .52, umami: .66, rich: .65, crispy: .72, chewy: .28 }, proteins: ["beef"], carbs: ["pastry"], methods: ["baked"], imageHint: "🥟" },
];

export const SEED_DISHES = seeds.map(makeDish);

export function getSeedDish(id: string) {
  return SEED_DISHES.find((dish) => dish.id === id);
}
