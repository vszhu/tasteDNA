import OpenAI from "openai";
import { z } from "zod";
import { extractedMenuModelSchema, type ExtractedMenuModel } from "./schema";

const SYSTEM_PROMPT = `You extract only dishes that are visibly present in a restaurant menu image or explicitly present in pasted menu text. Never invent a dish. Return one object per unique menu item in menu order. Infer food traits from 0 to 1 conservatively. If something cannot be reasonably inferred, use a neutral low value, lower confidence, and list the field in unknownFields. Prices must be numeric without currency symbols.`;

export async function extractMenuWithOpenAI(input: { text?: string; image?: { mimeType: string; base64: string } }): Promise<ExtractedMenuModel> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  if (input.text) userContent.push({ type: "text", text: `Extract this menu:\n\n${input.text}` });
  if (input.image) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${input.image.mimeType};base64,${input.image.base64}`, detail: "high" },
    });
  }
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MENU_MODEL ?? "gpt-5-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "taste_dna_menu",
        strict: true,
        schema: z.toJSONSchema(extractedMenuModelSchema),
      },
    },
  });
  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error("The model returned an empty menu.");
  return extractedMenuModelSchema.parse(JSON.parse(raw));
}
