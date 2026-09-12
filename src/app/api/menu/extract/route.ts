import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { ensurePublicUser } from "@/lib/auth/bootstrap";
import { createAuthenticatedSupabaseServerClient } from "@/lib/db/supabase-auth-server";
import { getSupabaseAdminClient } from "@/lib/db/supabase-server";
import { extractMenuWithOpenAI, MenuExtractionFailedError } from "@/lib/menu/openai-extract";
import { parsePastedMenu, processExtractedMenu, processExtractedMenuWithEmbeddings } from "@/lib/menu/process";
import { SAMPLE_MENU_MODEL } from "@/lib/menu/sample";
import { authorizeSharedMenuUpload, SharedMenuAuthorizationError } from "@/lib/menu/shared-authorization";
import { buildSharedMenuIngestion } from "@/lib/menu/shared-normalize";
import { SupabaseSharedMenuRepository } from "@/lib/menu/shared-repository";
import type { ExtractedMenu } from "@/types";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const venueIdSchema = z.string().uuid();

function extractionErrorResponse(error: MenuExtractionFailedError) {
  const reasons = [error.primaryReason, error.fallbackReason].filter(Boolean);
  const terminalReason = error.fallbackReason ?? error.primaryReason;
  if (reasons.every((reason) => reason === "rate_limit")) {
    return NextResponse.json({ error: "The menu reader is busy right now. Please wait a moment and try again." }, { status: 429 });
  }
  if (terminalReason === "timeout") {
    return NextResponse.json({ error: "The menu took too long to read. Try a smaller or clearer photo." }, { status: 504 });
  }
  if (terminalReason === "empty_menu" || terminalReason === "invalid_structured_output") {
    return NextResponse.json({ error: "The menu was read, but no complete dishes were found. Try a clearer photo." }, { status: 422 });
  }
  return NextResponse.json({ error: "We couldn’t decode that menu. Try a clearer photo or paste the menu text." }, { status: 502 });
}

export async function POST(request: Request) {
  const requestStarted = performance.now();
  try {
    const formData = await request.formData();
    const rawText = formData.get("text");
    const rawFile = formData.get("image");
    const rawVenueId = formData.get("venueId");
    const text = typeof rawText === "string" ? rawText.trim() : "";
    const image = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
    const venueId = typeof rawVenueId === "string" && rawVenueId.trim()
      ? venueIdSchema.safeParse(rawVenueId.trim())
      : null;

    if (!text && !image) return NextResponse.json({ error: "Add a menu photo or paste menu text." }, { status: 400 });
    if (venueId && !venueId.success) return NextResponse.json({ error: "Choose a valid venue before sharing this menu." }, { status: 400 });
    if (text.length > 25_000) return NextResponse.json({ error: "Menu text must be under 25,000 characters." }, { status: 413 });
    if (image && image.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Menu images must be smaller than 8 MB." }, { status: 413 });
    if (image && !ALLOWED_TYPES.has(image.type)) return NextResponse.json({ error: "Use a JPG, PNG, WebP or HEIC menu image." }, { status: 415 });

    let uploaderId: string | null = null;
    let sharedRepository: SupabaseSharedMenuRepository | null = null;
    if (venueId?.success) {
      const authClient = await createAuthenticatedSupabaseServerClient();
      if (!authClient) return NextResponse.json({ error: "Supabase sign-in is not configured." }, { status: 503 });
      const uploader = await authorizeSharedMenuUpload(authClient, venueId.data);
      await ensurePublicUser(authClient, uploader);
      const adminClient = getSupabaseAdminClient();
      if (!adminClient) return NextResponse.json({ error: "Shared menu storage is not configured." }, { status: 503 });
      uploaderId = uploader.id;
      sharedRepository = new SupabaseSharedMenuRepository(adminClient);
    }

    const demoMode = process.env.TASTEDNA_DEMO_MODE === "true" || !process.env.OPENAI_API_KEY;
    if (venueId?.success && image && demoMode) {
      return NextResponse.json({ error: "Live menu reading must be configured before a photo can become a shared venue menu." }, { status: 503 });
    }

    let result: ExtractedMenu;
    let sourceProvider: string;
    let extractionModel: string | null = null;
    if (demoMode) {
      const model = text ? parsePastedMenu(text) : SAMPLE_MENU_MODEL;
      if (model.dishes.length === 0) return NextResponse.json({ error: "No menu dishes were found. Try one dish per line." }, { status: 422 });
      result = processExtractedMenu(
        model,
        image ? "image" : "text",
        true,
        image ? "Demo extraction used because live AI is not configured." : "Local text parsing used; add an OpenAI key for richer extraction.",
      );
      sourceProvider = text ? "local-parser-v1" : "demo-fixture";
    } else {
      const base64 = image ? Buffer.from(await image.arrayBuffer()).toString("base64") : undefined;
      const extraction = await extractMenuWithOpenAI({
        text: text || undefined,
        image: image && base64 ? { mimeType: image.type, base64 } : undefined,
      });
      result = await processExtractedMenuWithEmbeddings(extraction.menu, image ? "image" : "text", false);
      sourceProvider = `openai:${extraction.model}`;
      extractionModel = extraction.model;
      if (process.env.NODE_ENV === "development") {
        console.info("[TasteDNA timing] menu API total", {
          durationMs: Math.round(performance.now() - requestStarted),
          extractionMs: extraction.extractionMs,
          model: extraction.model,
          fallback: extraction.usedModelFallback,
          dishes: result.items.length,
          uploadBytes: image?.size ?? 0,
        });
      }
    }

    if (venueId?.success && uploaderId && sharedRepository) {
      const observedAt = new Date().toISOString();
      const ingestion = buildSharedMenuIngestion(result, {
        venueId: venueId.data,
        uploadedBy: uploaderId,
        sourceType: image ? "image" : "text",
        sourceProvider,
        sourceUri: null,
        sourceMetadata: {
          rawImageStored: false,
          usedFallback: result.usedFallback,
          ...(extractionModel ? { extractionModel } : {}),
        },
        observedAt,
      });
      const sharedMenu = await sharedRepository.ingest(ingestion);
      return NextResponse.json({ ...result, sharedMenu });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SharedMenuAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof MenuExtractionFailedError) return extractionErrorResponse(error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "The menu was read, but its structure was incomplete. Please try a clearer image." }, { status: 422 });
    }
    console.error("Menu extraction failed", { name: error instanceof Error ? error.name : "unknown_error" });
    return NextResponse.json({ error: "We couldn’t decode that menu. Try a clearer photo or paste the menu text." }, { status: 500 });
  }
}
