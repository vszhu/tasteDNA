import { AlertTriangle, ExternalLink, Info, Pill } from "lucide-react";
import { MEDICATION_SOURCES_CHECKED } from "@/lib/medications/catalog";
import { MEDICATION_STATUS_COPY, type MedicationCheck, type MedicationCheckStatus } from "@/lib/medications/check";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<MedicationCheckStatus, string> = {
  avoid: "border-[#edc1b6] bg-[#fff1ec] text-[#8c3327]",
  review: "border-[#e7d29f] bg-[#fff8e7] text-[#71561d]",
  "no-listed-match": "border-[#d5dcd8] bg-[#f1f4f2] text-[#435b50]",
  "not-checked": "border-[var(--line)] bg-[var(--cream)] text-[var(--muted)]",
};

export function MedicationStatusBadge({ status }: { status: MedicationCheckStatus }) {
  const Icon = status === "avoid" ? AlertTriangle : status === "review" ? Info : Pill;
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_STYLE[status])}>
    <Icon className="size-3 shrink-0" />{MEDICATION_STATUS_COPY[status]}
  </span>;
}

export function MedicationCheckDetails({ check, compact = false }: { check: MedicationCheck; compact?: boolean }) {
  return <div className="space-y-3">
    {check.findings.length === 0 && <p className="text-sm leading-6 text-[var(--muted)]">{check.reason}</p>}
    {check.findings.map((finding) => compact ? <details key={finding.ruleId} className={cn("rounded-xl border p-3", STATUS_STYLE[finding.severity])}>
      <summary className="cursor-pointer text-xs font-bold leading-5">{finding.medicationName}: {finding.title}<span className="mt-1 block pl-4 text-[10px] font-medium">{finding.matchedTerms.join(", ")} · open evidence & source</span></summary>
      <p className="mt-3 text-xs leading-6">{finding.explanation}</p>
      <p className="mt-2 text-[10px] font-semibold leading-5">{finding.evidence === "menu-text" ? "Matched in extracted menu text" : finding.evidence === "qualified-mention" ? "Optional or omitted ingredient: confirm" : "Inferred ingredient: confirm with the restaurant"}</p>
      <div className="mt-3 rounded-lg bg-white/60 p-3 text-xs leading-6"><strong>Ask about this dish: </strong>{finding.question}</div>
      <a href={finding.source.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold underline underline-offset-4">{finding.source.title}<ExternalLink className="size-3 shrink-0" /><span className="sr-only"> (opens a new tab)</span></a>
      <p className="mt-1 text-[10px] leading-5">{finding.source.section} · Checked {MEDICATION_SOURCES_CHECKED}</p>
    </details> : <div key={finding.ruleId} className={cn("rounded-2xl border p-4", STATUS_STYLE[finding.severity])}>
      <p className="flex items-start gap-2 text-sm font-bold"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{finding.medicationName}: {finding.title}</p>
      <p className="mt-2 text-sm leading-6">{finding.explanation}</p>
      <p className="mt-3 text-xs font-semibold">{finding.evidence === "menu-text" ? "Matched in extracted menu text" : finding.evidence === "qualified-mention" ? "Omission or optional ingredient needs confirmation" : "Inferred ingredient — confirm with the restaurant"}: {finding.matchedTerms.join(", ")}</p>
      <div className="mt-3 rounded-xl bg-white/60 p-3 text-sm leading-6"><span className="font-bold">What to ask: </span>{finding.question}</div>
      <a href={finding.source.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">
        {finding.source.title}<ExternalLink className="size-3 shrink-0" /><span className="sr-only"> (opens a new tab)</span>
      </a>
      <p className="mt-1 text-[10px] leading-4">{finding.source.section} · Source checked {MEDICATION_SOURCES_CHECKED}</p>
    </div>)}
    {check.unsupportedMedications.length > 0 && <p className="text-sm leading-6 text-[#71561d]">Outside this reference: <strong>{check.unsupportedMedications.join(", ")}</strong>. Their interactions have not been checked.</p>}
    {check.needsIngredientDetails && check.findings.length > 0 && <p className="text-xs leading-5 text-[var(--muted)]">Ingredient details are also incomplete; other concerns may be missing.</p>}
  </div>;
}
