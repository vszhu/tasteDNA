import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { extractMenuWithOpenAI } from "@/lib/menu/openai-extract";
import { parsePastedMenu, processExtractedMenu } from "@/lib/menu/process";
import { SAMPLE_MENU_MODEL } from "@/lib/menu/sample";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawText = formData.get("text");
    const rawFile = formData.get("image");
    const text = typeof rawText === "string" ? rawText.trim() : "";
    const image = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;

    if (!text && !image) return NextResponse.json({ error: "Add a menu photo or paste menu text." }, { status: 400 });
    if (text.length > 25_000) return NextResponse.json({ error: "Menu text must be under 25,000 characters." }, { status: 413 });
    if (image && image.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Menu images must be smaller than 8 MB." }, { status: 413 });
    if (image && !ALLOWED_TYPES.has(image.type)) return NextResponse.json({ error: "Use a JPG, PNG, WebP or HEIC menu image." }, { status: 415 });

    const demoMode = process.env.TASTEDNA_DEMO_MODE === "true" || !process.env.OPENAI_API_KEY;
    if (demoMode) {
      const model = text ? parsePastedMenu(text) : SAMPLE_MENU_MODEL;
      if (model.dishes.length === 0) return NextResponse.json({ error: "No menu dishes were found. Try one dish per line." }, { status: 422 });
      return NextResponse.json(processExtractedMenu(
        model,
        image ? "image" : "text",
        true,
        image ? "Demo extraction used because live AI is not configured." : "Local text parsing used; add an OpenAI key for richer extraction.",
      ));
    }

    const base64 = image ? Buffer.from(await image.arrayBuffer()).toString("base64") : undefined;
    const model = await extractMenuWithOpenAI({
      text: text || undefined,
      image: image && base64 ? { mimeType: image.type, base64 } : undefined,
    });
    if (model.dishes.length === 0) return NextResponse.json({ error: "The menu was readable, but no dishes were found." }, { status: 422 });
    return NextResponse.json(processExtractedMenu(model, image ? "image" : "text", false));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "The menu was read, but its structure was incomplete. Please try a clearer image." }, { status: 422 });
    }
    console.error("Menu extraction failed", error);
    return NextResponse.json({ error: "We couldn’t decode that menu. Try a clearer photo or paste the menu text." }, { status: 500 });
  }
}
