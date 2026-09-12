/** A versioned reference of selected food interactions, not a complete drug database. */
export const MEDICATION_RULES_VERSION = "2026-09-12.2";
export const MEDICATION_SOURCES_CHECKED = "2026-09-12";

export interface MedicationSource {
  title: string;
  url: string;
  section: string;
}

export interface FoodInteractionRule {
  id: string;
  terms: readonly string[];
  /** These overlapping phrases need confirmation rather than an asserted ingredient warning. */
  qualifiedPhrases?: readonly string[];
  severity: "avoid" | "review";
  title: string;
  explanation: string;
  question: string;
  source: MedicationSource;
}

export interface MedicationReference {
  id: string;
  name: string;
  form: string;
  aliases: readonly string[];
  requireFormSelection?: boolean;
  summary: string;
  rules: readonly FoodInteractionRule[];
}

const simvastatinLabel: MedicationSource = {
  title: "DailyMed · Simvastatin tablets",
  url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4724dbb4-3613-4e6a-948f-a43d34f97f06",
  section: "7.1 · Grapefruit juice",
};

const linezolidLabel: MedicationSource = {
  title: "DailyMed · Linezolid tablets",
  url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=90dd8c13-c428-4472-91e5-5b1fcdc4fce3",
  section: "17 · Patient counseling: tyramine",
};

const alcoholTerms = ["alcohol", "beer", "wine", "vodka", "rum", "whiskey", "whisky", "gin", "tequila", "bourbon", "liqueur", "sake"];
// A menu cannot establish residual alcohol, including in cooked preparations.
const alcoholQualifiedPhrases = [
  "root beer", "ginger beer", "wine vinegar", "red wine vinegar", "white wine vinegar", "rice wine vinegar", "beer batter", "beer battered", "rum cake", "rum raisin",
  ...alcoholTerms.flatMap((term) => [`alcohol free ${term}`, `non alcoholic ${term}`, `nonalcoholic ${term}`, `${term} sauce`, `${term} reduction`, `${term} braised`, `braised in ${term}`]),
];
const caffeineTerms = ["caffeine", "coffee", "espresso", "tea", "energy drink", "energy drinks", "cola", "chocolate"];

function medlineSource(name: string, article: string, section = "Special dietary instructions"): MedicationSource {
  return { title: `MedlinePlus · ${name}`, url: `https://medlineplus.gov/druginfo/meds/${article}.html`, section };
}

export const MEDICATION_CATALOG: readonly MedicationReference[] = [
  {
    id: "simvastatin", name: "Simvastatin", form: "Oral tablets", aliases: ["zocor", "simvastatin tablets"],
    summary: "Grapefruit juice warning; grapefruit ingredients need confirmation.",
    rules: [
      {
        id: "simvastatin-grapefruit-juice", terms: ["grapefruit juice"], severity: "avoid",
        title: "Grapefruit juice warning",
        explanation: "The label advises avoiding grapefruit juice while taking simvastatin because it can increase drug exposure and muscle-related adverse effects.",
        question: "Does this dish or drink contain grapefruit juice, including in its dressing or sauce?",
        source: simvastatinLabel,
      },
      {
        id: "simvastatin-grapefruit", terms: ["grapefruit"], severity: "review",
        title: "Check grapefruit with your pharmacist",
        explanation: "MedlinePlus advises discussing grapefruit and grapefruit juice with your clinician while taking simvastatin. The menu cannot establish the amount or preparation.",
        question: "Is grapefruit used in the dish, dressing, garnish, or sauce?",
        source: {
          title: "MedlinePlus · Simvastatin",
          url: "https://medlineplus.gov/druginfo/meds/a692030.html",
          section: "Special dietary instructions",
        },
      },
    ],
  },
  {
    id: "fexofenadine", name: "Fexofenadine", form: "Oral tablets", aliases: ["allegra", "allegra allergy", "fexofenadine hydrochloride"],
    summary: "Fruit juice matters when taking the tablet; the label directs taking it with water.",
    rules: [{
      id: "fexofenadine-fruit-juice", severity: "review",
      terms: ["fruit juice", "orange juice", "apple juice", "grapefruit juice", "grape juice", "cranberry juice", "pineapple juice", "pomegranate juice", "mango juice", "lemon juice", "lime juice"],
      title: "Check what you take your tablet with",
      explanation: "The tablet label directs taking fexofenadine with water, not fruit juice. This is an administration warning, not a blanket restriction on fruit at every meal.",
      question: "Does this drink contain fruit juice? If you are taking your tablet with this meal, follow its water-only direction and ask your pharmacist about timing.",
      source: {
        title: "DailyMed · Allegra Allergy tablets",
        url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f061d6b1-89f7-4d5f-ac59-9c73408517c1",
        section: "Warnings and directions · Fruit juices",
      },
    }],
  },
  {
    id: "linezolid", name: "Linezolid", form: "Oral tablets", aliases: ["zyvox", "linezolid tablets"],
    summary: "Large amounts of high-tyramine foods need attention; portions and preparation matter.",
    rules: [{
      id: "linezolid-tyramine", severity: "review",
      terms: ["aged cheese", "aged cheeses", "aged cheddar", "aged parmesan", "fermented meat", "fermented meats", "air dried meat", "air dried meats", "sauerkraut", "soy sauce", "tap beer", "tap beers", "draft beer", "draught beer", "red wine"],
      title: "Tyramine: check the portion and preparation",
      explanation: "The label advises avoiding large quantities of high-tyramine foods. Tyramine varies with aging, fermentation, storage, and portion size; a menu cannot quantify it.",
      question: "Can the kitchen confirm the portion and how this ingredient is aged or fermented? Ask your pharmacist how the label guidance applies to your meal.",
      source: linezolidLabel,
    }],
  },
  {
    id: "tacrolimus-capsules", name: "Tacrolimus", form: "Immediate-release oral capsules", aliases: ["tacrolimus capsules", "tacrolimus oral capsules"], requireFormSelection: true,
    summary: "Grapefruit and grapefruit juice warning. This entry is for oral capsules, not ointment.",
    rules: [{
      id: "tacrolimus-grapefruit", terms: ["grapefruit"], severity: "avoid",
      title: "Grapefruit warning",
      explanation: "The capsule label advises avoiding grapefruit and grapefruit juice because they can increase tacrolimus exposure and the risk of serious adverse reactions.",
      question: "Is grapefruit used anywhere in this dish or drink, including the dressing or garnish?",
      source: {
        title: "DailyMed · Tacrolimus capsules",
        url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=46ac55cf-d85e-4c34-bb33-f49e078c4a03",
        section: "2.1 and 7.2 · Grapefruit",
      },
    }],
  },
  {
    id: "atorvastatin-tablets", name: "Atorvastatin", form: "Oral tablets", requireFormSelection: true,
    aliases: ["lipitor", "lipitor tablets", "atorvastatin tablets", "atorvastatin oral tablets"],
    summary: "Discuss grapefruit with your clinician; this entry does not inherit simvastatin's avoidance rule.",
    rules: [{
      id: "atorvastatin-grapefruit", terms: ["grapefruit"], severity: "review",
      title: "Review grapefruit for this medication",
      explanation: "MedlinePlus recommends discussing grapefruit with your clinician while taking atorvastatin. The menu does not establish the amount or your individual instructions.",
      question: "Does this contain grapefruit or its juice, and how much? Confirm your medication-specific guidance with your pharmacist.",
      source: medlineSource("Atorvastatin", "a600045"),
    }],
  },
  {
    id: "levothyroxine-tablets", name: "Levothyroxine", form: "Oral tablets", requireFormSelection: true,
    aliases: ["synthroid", "levoxyl", "unithroid", "levothyroxine tablets", "levothyroxine sodium tablets"],
    summary: "Soy-containing foods, walnuts, dietary fiber, and grapefruit may need a food/timing review.",
    rules: [{
      id: "levothyroxine-food-absorption", severity: "review",
      terms: ["soybean", "soybeans", "soy flour", "soybean flour", "soy milk", "soymilk", "tofu", "walnut", "walnuts", "dietary fiber", "high fiber"],
      title: "Review food and tablet timing",
      explanation: "Foods containing soybeans, walnuts, or dietary fiber can affect levothyroxine's action. Follow your tablet's prescribed food schedule and discuss these foods with your clinician; this finding does not set a new dosing schedule.",
      question: "Can the kitchen confirm these ingredients? Ask your pharmacist how this meal fits your usual tablet routine.",
      source: medlineSource("Levothyroxine", "a682461"),
    }, {
      id: "levothyroxine-grapefruit", terms: ["grapefruit"], severity: "review",
      title: "Discuss grapefruit with your clinician",
      explanation: "MedlinePlus advises a clinician discussion about grapefruit during levothyroxine treatment. This reference cannot determine an appropriate portion or timing for you.",
      question: "Is grapefruit or grapefruit juice included in the food or drink?",
      source: medlineSource("Levothyroxine", "a682461"),
    }],
  },
  {
    id: "ciprofloxacin-tablets", name: "Ciprofloxacin", form: "Immediate-release oral tablets", requireFormSelection: true,
    aliases: ["cipro tablets", "ciprofloxacin tablets", "ciprofloxacin oral tablets"],
    summary: "Check dairy/fortified drinks at dosing and large amounts of caffeine. Dairy in a meal is a different case.",
    rules: [{
      id: "ciprofloxacin-dairy-at-dose", severity: "review",
      terms: ["milk", "yogurt", "yoghurt", "dairy", "calcium fortified juice", "calcium fortified juices", "calcium fortified orange juice", "calcium fortified apple juice"],
      title: "Dairy at dosing: check the meal context",
      explanation: "Ciprofloxacin should not be taken with dairy or calcium-fortified juice by itself, but a meal containing them is allowed by the instructions. This is a dosing-context check, not a dairy-free diet recommendation.",
      question: "Are you taking the tablet with this drink alone or with a full meal? Check your prescription directions and ask your pharmacist if unsure.",
      source: medlineSource("Ciprofloxacin", "a688016", "How should this medicine be used? · Dairy and fortified juice"),
    }, {
      id: "ciprofloxacin-caffeine", terms: caffeineTerms, severity: "review",
      title: "Check the amount of caffeine",
      explanation: "Ciprofloxacin can intensify caffeine effects. MedlinePlus advises limiting large amounts of caffeinated foods and drinks; the menu does not tell us the caffeine content or your total intake.",
      question: "Is this caffeinated, and what is the serving size? Confirm your caffeine guidance with your pharmacist.",
      source: medlineSource("Ciprofloxacin", "a688016"),
    }],
  },
  {
    id: "metronidazole-tablets", name: "Metronidazole", form: "Immediate-release oral tablets", requireFormSelection: true,
    aliases: ["flagyl tablets", "metronidazole tablets", "metronidazole oral tablets"],
    summary: "Alcohol and propylene glycol warning during treatment and for at least three days after the final dose.",
    rules: [{
      id: "metronidazole-alcohol", terms: [...alcoholTerms, "propylene glycol"], qualifiedPhrases: alcoholQualifiedPhrases, severity: "avoid",
      title: "Alcohol / propylene glycol warning",
      explanation: "The oral-tablet label warns against alcohol and propylene glycol during treatment and for at least three days afterward. A menu cannot measure alcohol remaining in a sauce, dessert, or supposedly alcohol-free drink.",
      question: "Does this contain alcohol or propylene glycol, including in sauces or desserts? Confirm with the restaurant and your pharmacist; do not assume cooking removes it.",
      source: { title: "DailyMed · Metronidazole tablets", url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b8fd8441-624d-4600-b1ca-17d5be73b203", section: "Contraindications / Drug interactions · Alcohol and propylene glycol" },
    }],
  },
  {
    id: "spironolactone-tablets", name: "Spironolactone", form: "Oral tablets", requireFormSelection: true,
    aliases: ["aldactone", "aldactone tablets", "spironolactone tablets", "spironolactone oral tablets"],
    summary: "Potassium-containing salt substitutes need attention; food portions depend on your clinician's plan.",
    rules: [{
      id: "spironolactone-potassium-salt", severity: "avoid",
      terms: ["potassium chloride", "potassium salt substitute", "potassium containing salt substitute", "potassium based salt substitute"],
      title: "Potassium salt-substitute warning",
      explanation: "The tablet label warns that potassium sources, including potassium-containing salt substitutes, can cause dangerously high potassium with spironolactone. Ordinary table salt is not identified as potassium by this check.",
      question: "Is a potassium-containing salt substitute used in the seasoning? Confirm its ingredients with the kitchen.",
      source: { title: "DailyMed · Spironolactone tablets", url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=beaf74db-4159-3b59-ef99-575c3ac99aa1", section: "5.1 and 17 · Hyperkalemia and patient counseling" },
    }, {
      id: "spironolactone-food-portions", severity: "review", terms: ["banana", "bananas", "prune", "prunes", "raisins", "orange juice"],
      title: "Review potassium-rich food portions",
      explanation: "MedlinePlus recommends discussing portions of potassium-rich foods with your clinician. This is not a personalized potassium limit; kidney function, blood tests, and your prescribed diet matter.",
      question: "What is the portion of this ingredient? Check it against the dietary plan from your clinician.",
      source: medlineSource("Spironolactone", "a682627"),
    }],
  },
  {
    id: "buspirone-tablets", name: "Buspirone", form: "Oral tablets", requireFormSelection: true,
    aliases: ["buspar", "buspirone tablets", "buspirone hydrochloride tablets"],
    summary: "Review large grapefruit portions and alcohol-containing drinks or preparations.",
    rules: [{
      id: "buspirone-grapefruit", terms: ["grapefruit"], severity: "review",
      title: "Grapefruit quantity needs review",
      explanation: "MedlinePlus cautions against large amounts of grapefruit during buspirone treatment. A menu mention alone cannot determine the portion or whether it fits your clinician's advice.",
      question: "How much grapefruit or grapefruit juice is used? Discuss the amount with your pharmacist.",
      source: medlineSource("Buspirone", "a688005"),
    }, {
      id: "buspirone-alcohol", terms: alcoholTerms, qualifiedPhrases: alcoholQualifiedPhrases, severity: "avoid",
      title: "Alcohol warning",
      explanation: "The tablet label advises avoiding alcohol with buspirone. Confirm alcohol content in drinks and food preparations; the menu cannot establish what remains after cooking.",
      question: "Does this drink, sauce, or dessert contain alcohol? Ask the kitchen to verify and follow your prescription advice.",
      source: { title: "DailyMed · Buspirone hydrochloride tablets", url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0d46cf24-07e1-4bb7-8b5b-5ce12a030afd", section: "Precautions · Interference with cognitive and motor performance" },
    }],
  },
  {
    id: "alendronate-tablets", name: "Alendronate", form: "Standard oral tablets", requireFormSelection: true,
    aliases: ["fosamax tablets", "alendronate tablets", "alendronate sodium tablets"],
    summary: "The tablet requires plain water and its prescribed fasting interval; other drinks need a timing check.",
    rules: [{
      id: "alendronate-dose-beverage", severity: "review",
      terms: ["tea", "coffee", "espresso", "juice", "milk", "mineral water", "sparkling water", "carbonated water", "seltzer"],
      title: "Check your tablet's plain-water routine",
      explanation: "Alendronate tablets are taken with plain water and a waiting period before food or other drinks. This note concerns taking the dose; it does not prohibit these drinks throughout the day. Follow your own prescription instructions.",
      question: "Are you taking the tablet now, or has its prescribed waiting period passed? Ask your pharmacist if the timing is unclear.",
      source: medlineSource("Alendronate", "a601011", "How should this medicine be used? · Tablet and plain-water instructions"),
    }],
  },
  {
    id: "phenelzine-tablets", name: "Phenelzine", form: "Oral tablets", requireFormSelection: true,
    aliases: ["nardil", "nardil tablets", "phenelzine tablets", "phenelzine sulfate tablets"],
    summary: "Tyramine and caffeine require the specific food guidance from your clinician or dietitian.",
    rules: [{
      id: "phenelzine-tyramine", severity: "review",
      terms: ["aged cheese", "aged cheeses", "aged cheddar", "aged parmesan", "smoked cheese", "smoked fish", "smoked salmon", "smoked meat", "fermented yeast", "fermented yeast extract"],
      title: "Tyramine: confirm against your food plan",
      explanation: "High-tyramine foods can cause a serious reaction with phenelzine. Aging, smoking, storage, and portions matter; use the avoid/limit list from your clinician or dietitian. This menu check cannot quantify tyramine.",
      question: "How is this food aged, smoked, or stored, and what is the portion? Confirm that it fits your prescribed food guidance before ordering.",
      source: medlineSource("Phenelzine", "a682089"),
    }, {
      id: "phenelzine-caffeine", terms: caffeineTerms, severity: "review",
      title: "Confirm caffeine content",
      explanation: "MedlinePlus advises avoiding caffeine during phenelzine treatment. A menu's coffee, tea, or chocolate wording cannot establish caffeine content; check the preparation with your clinician's food guidance in mind.",
      question: "Does this contain caffeine, including in chocolate or an energy drink? Do not assume a decaf label means none.",
      source: medlineSource("Phenelzine", "a682089"),
    }],
  },
];

export function normalizeMedicationName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Exact aliases only: never infer a medicine, formulation, or dose from fuzzy text. */
export function findMedication(value: string): MedicationReference | undefined {
  const normalized = normalizeMedicationName(value);
  return MEDICATION_CATALOG.find((medication) =>
    [medication.id, ...medication.aliases, ...(medication.requireFormSelection ? [] : [medication.name])]
      .some((alias) => normalizeMedicationName(alias) === normalized),
  );
}

export function medicationDisplayName(value: string): string {
  const medication = findMedication(value);
  return medication ? `${medication.name} · ${medication.form}` : value;
}
