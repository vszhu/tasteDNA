import { findMedication, normalizeMedicationName } from "./catalog";
import { canShortlist, type MedicationFinding, type MedicationRecommendation, type MedicationCheckStatus } from "./check";

export interface MedicationMapNode {
  id: string;
  kind: "medication" | "ingredient" | "dish";
  label: string;
  detail: string;
  status: MedicationCheckStatus;
  menuItemId?: string;
}

export interface MedicationMapPath {
  id: string;
  medicationId: string;
  ingredientId: string;
  dishId: string;
  finding: MedicationFinding;
  evidence: MedicationFinding["evidence"];
  severity: "avoid" | "review";
}

export interface MedicationMap {
  nodes: MedicationMapNode[];
  paths: MedicationMapPath[];
}

export function dishNodeId(menuItemId: string) { return `dish:${menuItemId}`; }

const priority: Record<MedicationCheckStatus, number> = { avoid: 4, review: 3, "no-listed-match": 2, "not-checked": 1 };
function strongest(a: MedicationCheckStatus, b: MedicationCheckStatus) { return priority[a] >= priority[b] ? a : b; }

/** Only complete, evidenced medicine → term → dish paths. Never drug–drug edges. */
export function buildMedicationMap(recommendations: readonly MedicationRecommendation[], selections: readonly string[]): MedicationMap {
  const nodes = new Map<string, MedicationMapNode>();
  const paths: MedicationMapPath[] = [];
  const checked = recommendations.some((item) => item.medicationCheck.status !== "not-checked");
  const medicines = [...new Set(selections.map((value) => findMedication(value)?.id ?? normalizeMedicationName(value)))];
  for (const value of medicines) {
    const reference = findMedication(value);
    const id = `medication:${value}`;
    nodes.set(id, { id, kind: "medication", label: reference?.name ?? value, detail: reference?.form ?? "Outside this reference", status: !reference ? "review" : checked ? "no-listed-match" : "not-checked" });
  }
  for (const item of recommendations) {
    const id = dishNodeId(item.menuItemId);
    nodes.set(id, { id, kind: "dish", label: item.dish.name, detail: `${item.score}/100 taste match`, status: item.medicationCheck.status, menuItemId: item.menuItemId });
    if (item.medicationCheck.status === "not-checked") continue;
    for (const finding of item.medicationCheck.findings) {
      // Resolve rule ownership, not similar medication names or a shared food term.
      const medicine = medicines.find((value) => findMedication(value)?.rules.some((rule) => rule.id === finding.ruleId));
      if (!medicine) continue;
      const medicationId = `medication:${medicine}`;
      for (const term of finding.matchedTerms) {
        const ingredientId = `ingredient:${term}`;
        const evidence = finding.termEvidence.find((match) => match.term === term)?.evidence ?? finding.evidence;
        const severity = evidence === "menu-text" ? finding.severity : "review";
        const previous = nodes.get(ingredientId);
        nodes.set(ingredientId, { id: ingredientId, kind: "ingredient", label: term, detail: "Matched reference term", status: strongest(previous?.status ?? "not-checked", severity) });
        const medicationNode = nodes.get(medicationId)!;
        medicationNode.status = strongest(medicationNode.status, severity);
        paths.push({ id: JSON.stringify([item.menuItemId, finding.ruleId, term]), medicationId, ingredientId, dishId: id, finding, evidence, severity });
      }
    }
  }
  return { nodes: [...nodes.values()], paths };
}

/** Highlight entire matching paths, without traversing unrelated paths through a shared node. */
export function pathsForNode(map: MedicationMap, nodeId: string | null): MedicationMapPath[] {
  return nodeId ? map.paths.filter((path) => [path.medicationId, path.ingredientId, path.dishId].includes(nodeId)) : map.paths;
}

export function dishesForNode(map: MedicationMap, recommendations: readonly MedicationRecommendation[], nodeId: string | null) {
  const node = map.nodes.find((entry) => entry.id === nodeId);
  if (!node || node.kind === "dish") return [...recommendations];
  const ids = new Set(pathsForNode(map, nodeId).map((path) => path.dishId));
  return recommendations.filter((item) => ids.has(dishNodeId(item.menuItemId)));
}

/** Alternatives remain inside the existing review groups; no ingredient removal simulation. */
export function menuAlternatives(recommendations: readonly MedicationRecommendation[], currentMenuItemId?: string) {
  return recommendations.filter((item) => item.menuItemId !== currentMenuItemId && canShortlist(item.medicationCheck))
    .sort((a, b) => b.score - a.score || a.tasteRank - b.tasteRank).slice(0, 3);
}
