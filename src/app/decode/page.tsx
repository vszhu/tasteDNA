"use client";

import { ChangeEvent, FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Camera, FileText, ImagePlus, LockKeyhole, ScanLine, Sparkles, Upload, X } from "lucide-react";
import { useTaste } from "@/components/providers/taste-provider";
import { useSession } from "@/components/providers/session-provider";
import { MedicationSummary } from "@/components/medications/medication-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createMedicationDemoMenu } from "@/lib/medications/demo";
import {
  isSupportedMenuImageType,
  MAX_MENU_SOURCE_BYTES,
  MAX_MENU_UPLOAD_BYTES,
  optimizeMenuImage,
} from "@/lib/menu/image-optimization";
import type { ExtractedMenu } from "@/types";

const loadingMessages = ["Preparing menu…", "Reading the menu…", "Finding every dish…", "Mapping flavors and textures…", "Comparing with your TasteDNA…"];
const ANALYZE_STARTED_AT_KEY = "tastedna-analyze-started-at";

function safeReturnPath(value: string | null) {
  if (!value || /[\u0000-\u001f]/.test(value)) return null;
  if (value === "/venues" || value.startsWith("/sessions/")) return value;
  return null;
}

function DecodeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status } = useSession();
  const { profile, setExtractedMenu, hydrated } = useTaste();
  const venueId = searchParams.get("venueId")?.trim() || null;
  const venueName = searchParams.get("venueName")?.trim() || "this venue";
  const returnTo = safeReturnPath(searchParams.get("returnTo"));
  const sharingMenu = Boolean(venueId);
  const [mode, setMode] = useState<"image" | "text">("image");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [menuText, setMenuText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!loading || loadingStep === 0) return;
    const timer = window.setInterval(() => setLoadingStep((step) => Math.min(step + 1, loadingMessages.length - 1)), 950);
    return () => window.clearInterval(timer);
  }, [loading, loadingStep]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setError(null);
    if (!nextFile) return;
    if (!isSupportedMenuImageType(nextFile.type)) { setError("Use a JPG, PNG, WebP or HEIC menu image."); return; }
    if (nextFile.size > MAX_MENU_SOURCE_BYTES) { setError("That image is over 30 MB. Try a smaller photo."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sharingMenu && (status !== "signed-in" || !user)) { setError("Sign in before adding a shared venue menu."); return; }
    if (mode === "image" && !file) { setError("Choose or photograph a menu first."); return; }
    if (mode === "text" && !menuText.trim()) { setError("Paste at least one menu dish."); return; }
    const analyzeStartedAt = Date.now();
    if (process.env.NODE_ENV === "development") sessionStorage.setItem(ANALYZE_STARTED_AT_KEY, String(analyzeStartedAt));
    setLoading(true); setLoadingStep(mode === "image" ? 0 : 1); setError(null);
    try {
      const body = new FormData();
      let uploadFile = file;
      if (file && mode === "image") {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        try {
          const optimized = await optimizeMenuImage(file);
          uploadFile = optimized.file;
          if (process.env.NODE_ENV === "development") {
            console.info("[TasteDNA timing] client image preprocessing", optimized.diagnostics);
          }
        } catch (optimizationError) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[TasteDNA] Image preprocessing failed; using the original when safe", {
              reason: optimizationError instanceof Error ? optimizationError.name : "unknown_error",
            });
          }
          uploadFile = file;
        }
        if (uploadFile.size > MAX_MENU_UPLOAD_BYTES) {
          throw new Error("We couldn’t reduce this image below 8 MB. Try a JPG, PNG, or WebP photo with a smaller file size.");
        }
        body.set("image", uploadFile);
        setLoadingStep(1);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      if (menuText && mode === "text") body.set("text", menuText);
      if (venueId) body.set("venueId", venueId);
      const requestStarted = performance.now();
      const response = await fetch("/api/menu/extract", { method: "POST", body });
      if (process.env.NODE_ENV === "development") {
        console.info("[TasteDNA timing] menu upload and request", {
          durationMs: Math.round(performance.now() - requestStarted),
          uploadBytes: uploadFile && mode === "image" ? uploadFile.size : 0,
          status: response.status,
        });
      }
      const payload = await response.json() as ExtractedMenu | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Menu extraction failed.");
      setExtractedMenu(payload);
      router.push(returnTo ?? "/results");
    } catch (caught) {
      if (process.env.NODE_ENV === "development") {
        console.info("[TasteDNA timing] Analyze Menu failed", { durationMs: Date.now() - analyzeStartedAt });
        sessionStorage.removeItem(ANALYZE_STARTED_AT_KEY);
      }
      setError(caught instanceof Error ? caught.message : "We couldn’t decode that menu.");
      setLoading(false);
    }
  }

  if (loading) return <section aria-busy="true" className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16 text-center"><div className="w-full"><div className="relative mx-auto h-56 w-44 overflow-hidden rounded-2xl border-4 border-white bg-[#e9dfca] shadow-2xl"><div className="space-y-3 p-5">{[80, 55, 72, 64, 88, 48].map((width, index) => <div key={index} className="h-2 rounded bg-[var(--ink)]/15" style={{ width: `${width}%` }} />)}</div><div className="scan-line absolute inset-x-0 top-0 h-1 bg-[var(--tomato)] shadow-[0_0_22px_5px_rgba(214,83,62,.6)]" /><ScanLine className="absolute bottom-5 left-1/2 size-8 -translate-x-1/2 text-[var(--tomato)]" /></div><h1 role="status" aria-live="polite" className="mt-9 text-4xl">{loadingMessages[loadingStep]}</h1><p className="mt-3 text-[var(--muted)]">Turning menu language into your language.</p><div className="mx-auto mt-7 flex max-w-xs gap-2">{loadingMessages.map((_, index) => <span key={index} className={cn("h-1.5 flex-1 rounded-full transition-colors", index <= loadingStep ? "bg-[var(--tomato)]" : "bg-black/10")} />)}</div></div></section>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">MENU DECODER</p><h1 className="mt-3 text-5xl sm:text-6xl">What should you order?</h1><p className="mx-auto mt-4 max-w-xl leading-7 text-[var(--muted)]">Upload a clear menu photo or paste the text. We’ll read the dishes and rank every one for your palate.</p></div>
      {sharingMenu && (
        <div className="mx-auto mt-7 max-w-3xl rounded-2xl border border-[#e7d29f] bg-[#fff8e7] p-4 text-sm text-[#71561d]">
          <p className="font-bold">Adding a shared menu for {venueName}</p>
          <p className="mt-1">Once saved, everyone can use this venue in a real group session.</p>
          {status === "signed-out" && <p className="mt-2"><Link href="/sign-in" className="font-bold underline">Sign in first</Link> to attach the menu.</p>}
        </div>
      )}
      <MedicationSummary className="mx-auto mt-7 max-w-3xl" />
      <form onSubmit={submit} className="mx-auto mt-7 max-w-3xl">
        <div className="mx-auto mb-5 grid max-w-sm grid-cols-2 rounded-full bg-black/6 p-1"><button type="button" aria-pressed={mode === "image"} onClick={() => setMode("image")} className={cn("flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all", mode === "image" ? "bg-white shadow-sm" : "text-[var(--muted)]")}><ImagePlus className="size-4" /> Photo</button><button type="button" aria-pressed={mode === "text"} onClick={() => setMode("text")} className={cn("flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all", mode === "text" ? "bg-white shadow-sm" : "text-[var(--muted)]")}><FileText className="size-4" /> Paste text</button></div>
        <Card className="overflow-hidden">
          {mode === "image" ? <div>{preview ? <div className="relative aspect-[16/10] bg-black/5"><Image src={preview} alt="Selected menu preview" fill unoptimized className="object-contain" /><button type="button" aria-label="Remove image" onClick={() => { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(null); }} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white shadow-lg"><X className="size-4" /></button></div> : <button type="button" onClick={() => inputRef.current?.click()} className="group flex min-h-[360px] w-full flex-col items-center justify-center border-2 border-dashed border-transparent p-8 transition-colors hover:bg-[#f9f5ec]"><div className="grid size-20 place-items-center rounded-[1.6rem] bg-[#f0dfcc] transition-transform group-hover:-translate-y-1"><Upload className="size-8 text-[var(--tomato)]" /></div><h2 className="mt-6 text-2xl">Drop your menu here</h2><p className="mt-2 text-sm text-[var(--muted)]">or tap to choose a photo · JPG, PNG, WebP, HEIC · optimized locally · max 30 MB</p><div className="mt-6 flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold"><Camera className="size-3.5" /> Camera works on mobile</div></button>}<input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={chooseFile} /></div> : <CardContent className="p-5 sm:p-7"><label htmlFor="menu-text" className="text-sm font-bold">Paste menu text</label><textarea id="menu-text" value={menuText} onChange={(event) => setMenuText(event.target.value)} rows={13} placeholder={"Miso Butter Ramen — mushroom, egg, chile crisp  19\nCrispy Maitake Tacos — avocado crema, salsa macha  16"} className="mt-3 w-full resize-none rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-4 text-sm leading-7 outline-none transition-shadow placeholder:text-[var(--muted)]/55 focus:ring-2 focus:ring-[var(--tomato)]/30" /><p className="mt-2 text-xs text-[var(--muted)]">Tip: one dish per line works best in demo mode.</p></CardContent>}
        </Card>
        {error && <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}</div>}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><Button type="submit" disabled={!hydrated || (sharingMenu && status !== "signed-in")} size="lg" variant="accent" className="flex-1">{sharingMenu ? "Save shared menu" : "Decode this menu"} <ArrowRight className="size-4" /></Button>{!sharingMenu && <Button type="button" disabled={!hydrated} size="lg" variant="outline" onClick={() => { setExtractedMenu(createMedicationDemoMenu()); router.push("/results"); }}>Use sample menu</Button>}</div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--muted)]"><span className="flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> Processed server-side</span><span className="flex items-center gap-1.5"><Sparkles className="size-3.5" /> {profile.ratingCount ? `Personalized from ${profile.ratingCount} signals` : "Start with a neutral ranking"}</span></div>
      </form>
    </div>
  );
}

export default function DecodePage() {
  return (
    <Suspense fallback={<div role="status" className="mx-auto max-w-3xl px-6 py-16 text-center text-[var(--muted)]">Preparing the menu decoder…</div>}>
      <DecodeForm />
    </Suspense>
  );
}
