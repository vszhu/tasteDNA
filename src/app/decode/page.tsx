"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Camera, FileText, ImagePlus, LockKeyhole, ScanLine, Sparkles, Upload, X } from "lucide-react";
import { useTaste } from "@/components/providers/taste-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ExtractedMenu } from "@/types";

const loadingMessages = ["Reading the menu…", "Finding every dish…", "Mapping flavors and textures…", "Comparing with your TasteDNA…"];

export default function DecodePage() {
  const router = useRouter();
  const { profile, setExtractedMenu, loadDemo } = useTaste();
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
    if (!loading) return;
    const timer = window.setInterval(() => setLoadingStep((step) => Math.min(step + 1, loadingMessages.length - 1)), 950);
    return () => window.clearInterval(timer);
  }, [loading]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setError(null);
    if (!nextFile) return;
    if (nextFile.size > 8 * 1024 * 1024) { setError("That image is over 8 MB. Try a smaller photo."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "image" && !file) { setError("Choose or photograph a menu first."); return; }
    if (mode === "text" && !menuText.trim()) { setError("Paste at least one menu dish."); return; }
    setLoading(true); setLoadingStep(0); setError(null);
    try {
      const body = new FormData();
      if (file && mode === "image") body.set("image", file);
      if (menuText && mode === "text") body.set("text", menuText);
      const response = await fetch("/api/menu/extract", { method: "POST", body });
      const payload = await response.json() as ExtractedMenu | { error: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Menu extraction failed.");
      setExtractedMenu(payload);
      router.push("/results");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t decode that menu.");
      setLoading(false);
    }
  }

  if (loading) return <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16 text-center"><div className="w-full"><div className="relative mx-auto h-56 w-44 overflow-hidden rounded-2xl border-4 border-white bg-[#e9dfca] shadow-2xl"><div className="space-y-3 p-5">{[80, 55, 72, 64, 88, 48].map((width, index) => <div key={index} className="h-2 rounded bg-[var(--ink)]/15" style={{ width: `${width}%` }} />)}</div><div className="scan-line absolute inset-x-0 top-0 h-1 bg-[var(--tomato)] shadow-[0_0_22px_5px_rgba(214,83,62,.6)]" /><ScanLine className="absolute bottom-5 left-1/2 size-8 -translate-x-1/2 text-[var(--tomato)]" /></div><h1 className="mt-9 text-4xl">{loadingMessages[loadingStep]}</h1><p className="mt-3 text-[var(--muted)]">Turning menu language into your language.</p><div className="mx-auto mt-7 flex max-w-xs gap-2">{loadingMessages.map((_, index) => <span key={index} className={cn("h-1.5 flex-1 rounded-full transition-colors", index <= loadingStep ? "bg-[var(--tomato)]" : "bg-black/10")} />)}</div></div></section>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold tracking-[.18em] text-[var(--tomato)]">MENU DECODER</p><h1 className="mt-3 text-5xl sm:text-6xl">What should you order?</h1><p className="mx-auto mt-4 max-w-xl leading-7 text-[var(--muted)]">Upload a clear menu photo or paste the text. We’ll read the dishes and rank every one for your palate.</p></div>
      <form onSubmit={submit} className="mx-auto mt-10 max-w-3xl">
        <div className="mx-auto mb-5 grid max-w-sm grid-cols-2 rounded-full bg-black/6 p-1"><button type="button" onClick={() => setMode("image")} className={cn("flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all", mode === "image" ? "bg-white shadow-sm" : "text-[var(--muted)]")}><ImagePlus className="size-4" /> Photo</button><button type="button" onClick={() => setMode("text")} className={cn("flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all", mode === "text" ? "bg-white shadow-sm" : "text-[var(--muted)]")}><FileText className="size-4" /> Paste text</button></div>
        <Card className="overflow-hidden">
          {mode === "image" ? <div>{preview ? <div className="relative aspect-[16/10] bg-black/5"><Image src={preview} alt="Selected menu preview" fill unoptimized className="object-contain" /><button type="button" aria-label="Remove image" onClick={() => { setFile(null); setPreview(null); }} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white shadow-lg"><X className="size-4" /></button></div> : <button type="button" onClick={() => inputRef.current?.click()} className="group flex min-h-[360px] w-full flex-col items-center justify-center border-2 border-dashed border-transparent p-8 transition-colors hover:bg-[#f9f5ec]"><div className="grid size-20 place-items-center rounded-[1.6rem] bg-[#f0dfcc] transition-transform group-hover:-translate-y-1"><Upload className="size-8 text-[var(--tomato)]" /></div><h2 className="mt-6 text-2xl">Drop your menu here</h2><p className="mt-2 text-sm text-[var(--muted)]">or tap to choose a photo · JPG, PNG, WebP, HEIC · max 8 MB</p><div className="mt-6 flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold"><Camera className="size-3.5" /> Camera works on mobile</div></button>}<input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={chooseFile} /></div> : <CardContent className="p-5 sm:p-7"><label htmlFor="menu-text" className="text-sm font-bold">Paste menu text</label><textarea id="menu-text" value={menuText} onChange={(event) => setMenuText(event.target.value)} rows={13} placeholder={"Miso Butter Ramen — mushroom, egg, chile crisp  19\nCrispy Maitake Tacos — avocado crema, salsa macha  16"} className="mt-3 w-full resize-none rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-4 text-sm leading-7 outline-none transition-shadow placeholder:text-[var(--muted)]/55 focus:ring-2 focus:ring-[var(--tomato)]/30" /><p className="mt-2 text-xs text-[var(--muted)]">Tip: one dish per line works best in demo mode.</p></CardContent>}
        </Card>
        {error && <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}</div>}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><Button type="submit" size="lg" variant="accent" className="flex-1">Decode this menu <ArrowRight className="size-4" /></Button><Button type="button" size="lg" variant="outline" onClick={() => { loadDemo(); router.push("/results"); }}>Use sample menu</Button></div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--muted)]"><span className="flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> Processed server-side</span><span className="flex items-center gap-1.5"><Sparkles className="size-3.5" /> {profile.ratingCount ? `Personalized from ${profile.ratingCount} signals` : "Start with a neutral ranking"}</span></div>
      </form>
    </div>
  );
}
