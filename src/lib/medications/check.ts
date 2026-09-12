import type { Dish, ExtractedMenu, Recommendation, TasteProfile } from "@/types";
import { rankMenuItems } from "@/lib/recommendation/scoring";
import { findMedication, type FoodInteractionRule, type MedicationSource } from "./catalog";

export type MedicationCheckStatus = "not-checked" | "no-listed-match" | "review" | "avoid";

export interface MedicationFinding {
  ruleId: string;
  medicationName: string;
  severity: "avoid" | "review";
  title: string;
  explanation: string;
  question: string;
  source: MedicationSource;
  matchedTerms: string[];
  evidence: "menu-text" | "inferred-ingredient" | "qualified-mention";
  termEvidence: { term: string; evidence: MedicationFinding["evidence"] }[];
}

export interface MedicationCheck {
  status: MedicationCheckStatus;
  findings: MedicationFinding[];
  unsupportedMedications: string[];
  needsIngredientDetails: boolean;
  reason: string;
}

export interface MedicationRecommendation extends Recommendation {
  medicationCheck: MedicationCheck;
  tasteRank: number;
}

export const MEDICATION_STATUS_COPY: Record<MedicationCheckStatus, string> = {
  "not-checked": "Not checked",
  "no-listed-match": "No listed match · verify ingredients",
  review: "Needs review",
  avoid: "Label warning",
};

function normalizedWords(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function mentions(value: string, term: string, qualifiedPhrases: readonly string[] = []): { found: boolean; qualified: boolean } {
  const text = normalizedWords(value);
  const needle = normalizedWords(term);
  const pattern = new RegExp(`\\b${needle}\\b`, "g");
  const matches = [...text.matchAll(pattern)];
  return {
    found: matches.length > 0,
    qualified: matches.length > 0 && matches.every((match) => {
      const before = text.slice(0, match.index).split(" ").slice(-5).join(" ");
      const after = text.slice((match.index ?? 0) + needle.length).trim().split(" ").slice(0, 3).join(" ");
      // Qualify only the occurrence inside this phrase, not another confirmed
      // ingredient elsewhere (e.g. "root beer and vodka").
      const contextual = qualifiedPhrases.some((phrase) =>
        [...text.matchAll(new RegExp(`\\b${normalizedWords(phrase)}\\b`, "g"))].some((context) =>
          context.index! <= match.index! && context.index! + context[0].length >= match.index! + needle.length,
        ),
      );
      if (contextual) return true;
      return /\b(no|not|without|omit|omitted|optional|substitute|substituted|free of)\b/.test(before) ||
        /^(free|optional|omitted|removed|on request)\b/.test(after);
    }),
  };
}

function findingForRule(dish: Dish, medicationName: string, rule: FoodInteractionRule): MedicationFinding | null {
  const textFields = [dish.name, dish.description];
  const ingredientFields = [...dish.ingredients, ...dish.features.majorIngredients];
  const matches = rule.terms.flatMap((term) => {
    const textMentions = textFields.map((value) => mentions(value, term, rule.qualifiedPhrases)).filter((mention) => mention.found);
    const ingredientMentions = ingredientFields.map((value) => mentions(value, term, rule.qualifiedPhrases)).filter((mention) => mention.found);
    if (!textMentions.length && !ingredientMentions.length) return [];
    // A negated or optional menu mention must never be overridden by AI-inferred ingredients.
    const evidence: MedicationFinding["evidence"] = textMentions.length
      ? textMentions.every((mention) => mention.qualified) ? "qualified-mention" : "menu-text"
      : ingredientMentions.every((mention) => mention.qualified) ? "qualified-mention" : "inferred-ingredient";
    return [{ term, evidence }];
  });
  if (!matches.length) return null;
  const evidence = matches.some((match) => match.evidence === "menu-text") ? "menu-text"
    : matches.some((match) => match.evidence === "qualified-mention") ? "qualified-mention" : "inferred-ingredient";
  return {
    ruleId: rule.id, medicationName, source: rule.source, title: rule.title,
    explanation: rule.explanation, question: rule.question,
    severity: evidence === "menu-text" ? rule.severity : "review",
    matchedTerms: matches.map((match) => match.term), evidence, termEvidence: matches,
  };
}

/** Uses explicit extracted text/ingredients only. Taste traits never establish an interaction. */
export function checkDishMedications(dish: Dish, selections: readonly string[], unavailableReason?: string): MedicationCheck {
  const references = [...new Set(selections.map((value) => findMedication(value)?.id ?? value))];
  const unsupportedMedications = references.filter((value) => !findMedication(value));
  const needsIngredientDetails = dish.ingredients.length === 0 ||
    Boolean(dish.features.unknownFields?.some((field) => /ingredient|description/i.test(field)));
  if (!selections.length || unavailableReason) return {
    status: "not-checked", findings: [], unsupportedMedications, needsIngredientDetails,
    reason: unavailableReason ?? "Add medications to check the covered food interactions.",
  };
  const findings = references.flatMap((value) => {
    const medication = findMedication(value);
    if (!medication) return [];
    const matches = medication.rules.flatMap((rule) => {
      const finding = findingForRule(dish, medication.name, rule);
      return finding ? [finding] : [];
    });
    // Grapefruit juice already includes the broader grapefruit term; avoid duplicate alerts.
    return matches.some((finding) => finding.ruleId === "simvastatin-grapefruit-juice")
      ? matches.filter((finding) => finding.ruleId !== "simvastatin-grapefruit") : matches;
  });
  const status: MedicationCheckStatus = findings.some((finding) => finding.severity === "avoid") ? "avoid"
    : findings.length || unsupportedMedications.length || needsIngredientDetails ? "review" : "no-listed-match";
  const reason = status === "avoid" ? "A listed ingredient matches a medication label warning. Review it before choosing."
    : findings.length ? "An ingredient or administration detail needs confirmation before choosing."
    : unsupportedMedications.length ? "Some medications are outside this reference. Their interactions have not been checked."
    : needsIngredientDetails ? "Ingredient details are missing or uncertain. Ask the restaurant before choosing."
    : "No covered interaction matched the available text. Ingredients, amounts, and other interactions remain unverified.";
  return { status, findings, unsupportedMedications, needsIngredientDetails, reason };
}

export function unavailableMenuReason(menu: ExtractedMenu): string | undefined {
  if (menu.usedFallback && menu.menu.sourceType === "image") {
    return "This photo was replaced with a sample menu because live reading is unavailable. Medication checks cannot be applied to your photo.";
  }
}

/** Medication attention groups precede taste; the original taste scores are never modified. */
export function rankMedicationAwareMenu(menu: ExtractedMenu, profile: TasteProfile, selections: readonly string[]): MedicationRecommendation[] {
  const unavailableReason = unavailableMenuReason(menu);
  const priority: Record<MedicationCheckStatus, number> = { "no-listed-match": 0, review: 1, avoid: 2, "not-checked": 3 };
  return rankMenuItems(menu.items, profile)
    .map((recommendation) => ({
      ...recommendation, tasteRank: recommendation.rank,
      medicationCheck: checkDishMedications(recommendation.dish, selections, unavailableReason),
    }))
    .sort((left, right) => priority[left.medicationCheck.status] - priority[right.medicationCheck.status] || left.tasteRank - right.tasteRank)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
}

export function canShortlist(check: MedicationCheck): boolean {
  return check.status === "no-listed-match";
}

/** Price and menu-order controls only sort within the medication review groups. */
export function sortMedicationRecommendations(items: readonly MedicationRecommendation[], sort: "match" | "menu" | "price"): MedicationRecommendation[] {
  const priority: Record<MedicationCheckStatus, number> = { "no-listed-match": 0, review: 1, avoid: 2, "not-checked": 3 };
  return [...items].sort((left, right) => {
    const group = priority[left.medicationCheck.status] - priority[right.medicationCheck.status];
    if (group) return group;
    if (sort === "menu") return left.menuOrder - right.menuOrder;
    if (sort === "price") {
      const priceDifference = (left.price ?? Number.POSITIVE_INFINITY) - (right.price ?? Number.POSITIVE_INFINITY);
      if (priceDifference) return priceDifference;
    }
    return left.rank - right.rank;
  });
}
