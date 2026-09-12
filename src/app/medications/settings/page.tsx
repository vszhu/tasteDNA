import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { MedicationListEditor } from "@/components/medications/medication-list-editor";

export default function MedicationSettingsPage() {
  return <div className="mx-auto max-w-3xl px-4 py-9 sm:px-6">
    <div className="mb-6 flex flex-wrap justify-between gap-3 text-sm font-semibold">
      <Link href="/medications" className="inline-flex items-center gap-2"><ArrowLeft className="size-4" /> Food & medicine map</Link>
      <Link href="/friends" className="inline-flex items-center gap-2"><Users className="size-4" /> Back to my circle</Link>
    </div>
    <MedicationListEditor />
  </div>;
}
