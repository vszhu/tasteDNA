/** A deliberately small, versioned food-interaction reference, not a drug database. */
export const MEDICATION_RULES_VERSION = "2026-09-12.1";
export const MEDICATION_SOURCES_CHECKED = "2026-09-12";

export interface MedicationSource {
  title: string;
  url: string;
  section: string;
}

export interface FoodInteractionRule {
  id: string;
  terms: readonly string[];
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
    id: "tacrolimus-capsules", name: "Tacrolimus", form: "Immediate-release oral capsules", aliases: ["tacrolimus capsules", "tacrolimus oral capsules"],
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
];

export function normalizeMedicationName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Exact aliases only: never infer a medicine, formulation, or dose from fuzzy text. */
export function findMedication(value: string): MedicationReference | undefined {
  const normalized = normalizeMedicationName(value);
  return MEDICATION_CATALOG.find((medication) =>
    [medication.id, ...medication.aliases, ...(medication.id === "tacrolimus-capsules" ? [] : [medication.name])]
      .some((alias) => normalizeMedicationName(alias) === normalized),
  );
}

export function medicationDisplayName(value: string): string {
  const medication = findMedication(value);
  return medication ? `${medication.name} · ${medication.form}` : value;
}
