/**
 * Ingests the compiled CMU dining dataset as real shared venue menus.
 *
 *   npx tsx scripts/ingest-cmu-menus.ts --dry-run   # no network, prints a plan
 *   npx tsx scripts/ingest-cmu-menus.ts             # enriches + writes to Supabase
 *
 * Reads scripts/data/cmu-dining-menus.json, matches each restaurant to a row in
 * public.venues, turns its bare item names into full dish records, embeds them
 * in the SAME deterministic space the client-side taste profile uses, and
 * persists each menu through the existing ingest_shared_menu transaction.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { enrichVenueDishes } from "./enrich-dishes";
import { processExtractedMenu } from "../src/lib/menu/process";
import { buildSharedMenuIngestion } from "../src/lib/menu/shared-normalize";
import { SupabaseSharedMenuRepository } from "../src/lib/menu/shared-repository";
import type { ExtractedDishInput, ExtractedMenuModel } from "../src/lib/menu/schema";

const DATASET_PATH = resolve(process.cwd(), "scripts/data/cmu-dining-menus.json");
const ENV_PATH = resolve(process.cwd(), ".env.local");

/** Dataset name -> venues.name, for venues the feed renamed or reordered. */
const VENUE_NAME_OVERRIDES: Record<string, string> = {
  "ROHR CAFE - LA PRIMA": "LA PRIMA - ROHR CAFÉ",
  "ROHR COMMONS - TEPPER EATERY": "TEPPER EATERY AT ROHR COMMONS",
};

interface DatasetRestaurant {
  id: number;
  name: string;
  location?: string;
  items?: string[];
  menu_coverage?: string;
  menu_status?: string;
  menu_url?: string | null;
  menu_period?: string | null;
  extraction_method?: string | null;
  source_urls?: string[];
}

interface VenueRow { id: string; name: string; source_metadata: unknown }

function loadEnvLocal() {
  let raw: string;
  try {
    raw = readFileSync(ENV_PATH, "utf8");
  } catch {
    console.warn(`! No .env.local at ${ENV_PATH}; relying on the ambient environment.`);
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

/** Uppercase, strip accents and punctuation, collapse spaces. */
function canonical(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function tokens(name: string) {
  const stop = new Set(["THE", "AT", "BY", "AND", "A", "OF"]);
  return new Set(canonical(name).split(" ").filter((token) => token && !stop.has(token)));
}

function tokenOverlap(left: Set<string>, right: Set<string>) {
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / Math.max(left.size, right.size);
}

function matchVenue(datasetName: string, venues: VenueRow[]): VenueRow | null {
  const override = VENUE_NAME_OVERRIDES[canonical(datasetName)];
  const target = canonical(override ?? datasetName);

  const exact = venues.find((venue) => canonical(venue.name) === target);
  if (exact) return exact;

  const prefix = venues.filter((venue) => {
    const candidate = canonical(venue.name);
    return candidate.startsWith(target) || target.startsWith(candidate);
  });
  if (prefix.length === 1) return prefix[0];

  const targetTokens = tokens(override ?? datasetName);
  const scored = venues
    .map((venue) => ({ venue, score: tokenOverlap(targetTokens, tokens(venue.name)) }))
    .filter((entry) => entry.score >= 0.7)
    .sort((left, right) => right.score - left.score);
  if (scored.length > 0 && (scored.length === 1 || scored[0].score > scored[1].score)) return scored[0].venue;

  return null;
}

function conceptDescription(venue: VenueRow) {
  const metadata = venue.source_metadata;
  if (!metadata || typeof metadata !== "object") return "";
  const record = metadata as Record<string, unknown>;
  const short = typeof record.shortDescription === "string" ? record.shortDescription : "";
  const long = typeof record.description === "string" ? record.description : "";
  return (short || long).trim();
}

/** Deterministic stand-in used by --dry-run so the pipeline runs with no network. */
function offlineDish(name: string): ExtractedDishInput {
  const seed = [...name].reduce((total, character) => total + character.charCodeAt(0), 0);
  const trait = (offset: number) => Number((((seed * (offset + 7)) % 100) / 100).toFixed(2));
  return {
    name,
    description: `${name}, prepared fresh.`,
    price: null,
    category: "Unknown",
    cuisine: "Unknown",
    ingredients: [],
    sweet: trait(1), salty: trait(2), sour: trait(3), bitter: trait(4),
    umami: trait(5), spicy: trait(6), rich: trait(7), fresh: trait(8),
    crispy: trait(9), creamy: trait(10), chewy: trait(11), smoky: trait(12),
    proteinTypes: [], carbohydrateTypes: [], cookingMethods: [],
    confidence: 0.3,
    unknownFields: ["description"],
  };
}

async function resolveUploaderId(client: SupabaseClient, requested: string | undefined) {
  if (requested) {
    const { data, error } = await client.from("users").select("id,display_name").eq("id", requested).maybeSingle();
    if (error || !data) throw new Error(`No public.users row for --uploader ${requested}`);
    return { id: data.id as string, label: (data.display_name as string) ?? requested };
  }
  const { data, error } = await client.from("users").select("id,display_name").order("created_at").limit(1);
  if (error || !data?.length) throw new Error("No rows in public.users; sign in once before ingesting.");
  return { id: data[0].id as string, label: (data[0].display_name as string) ?? data[0].id };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const uploaderArg = process.argv.find((value) => value.startsWith("--uploader="))?.split("=")[1];
  const onlyFull = args.has("--only-full-menus");

  loadEnvLocal();

  const dataset = JSON.parse(readFileSync(DATASET_PATH, "utf8")) as {
    restaurants: DatasetRestaurant[];
    generated_date: string;
  };

  const restaurants = dataset.restaurants
    .filter((restaurant) => (restaurant.items?.length ?? 0) > 0)
    .filter((restaurant) => !onlyFull || restaurant.menu_coverage === "full_or_near_full");

  console.log(`Dataset ${dataset.generated_date}: ${restaurants.length} restaurants with items.`);

  let venues: VenueRow[];
  let client: SupabaseClient | null = null;
  let uploader = { id: "00000000-0000-4000-8000-000000000000", label: "(dry run)" };

  if (dryRun) {
    // Match against a snapshot of the real venues table so the offline plan
    // exercises the same name matching the live run will.
    const snapshot = resolve(process.cwd(), "scripts/data/venues-snapshot.json");
    venues = JSON.parse(readFileSync(snapshot, "utf8")) as VenueRow[];
    console.log(`Dry run: matching against ${venues.length} venue names from the snapshot.`);
  } else {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY must be set in .env.local");

    client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await client.from("venues").select("id,name,source_metadata").eq("is_active", true);
    if (error) throw new Error(`Unable to read venues: ${error.message}`);
    venues = (data ?? []) as VenueRow[];
    uploader = await resolveUploaderId(client, uploaderArg);
    console.log(`Matched against ${venues.length} active venues. Uploading as ${uploader.label}.`);
  }

  const repository = client ? new SupabaseSharedMenuRepository(client) : null;
  const unmatched: string[] = [];
  let created = 0;
  let reused = 0;
  let totalItems = 0;

  for (const restaurant of restaurants) {
    const venue = matchVenue(restaurant.name, venues);
    if (!venue) {
      unmatched.push(`${restaurant.name} (${restaurant.items?.length ?? 0} items)`);
      continue;
    }

    const names = [...new Set((restaurant.items ?? []).map((item) => item.trim()).filter(Boolean))];
    console.log(`\n${restaurant.name} -> ${venue.name} (${names.length} items)`);

    const dishes = dryRun
      ? names.map(offlineDish)
      : await enrichVenueDishes(
          { venueName: venue.name, conceptDescription: conceptDescription(venue) },
          names,
          (message) => console.log(message),
        );

    const model: ExtractedMenuModel = { restaurantName: venue.name, currency: "USD", dishes };
    const processed = processExtractedMenu(model, "text", false);
    totalItems += processed.items.length;

    const ingestion = buildSharedMenuIngestion(processed, {
      venueId: venue.id,
      uploadedBy: uploader.id,
      sourceType: "text",
      sourceProvider: dryRun ? "cmu-dataset-dry-run" : "cmu-dining-dataset-v2",
      sourceUri: restaurant.menu_url ?? null,
      sourceMetadata: {
        rawImageStored: false,
        usedFallback: false,
        datasetId: restaurant.id,
        datasetGeneratedDate: dataset.generated_date,
        menuCoverage: restaurant.menu_coverage ?? null,
        menuPeriod: restaurant.menu_period ?? null,
        // Names came from a real CMU menu; every other dish field was inferred.
        dishDetailsInferredFromNames: true,
      },
      observedAt: new Date().toISOString(),
    });

    if (!repository) {
      const sample = processed.items[0];
      console.log(`  dry run: ${ingestion.items.length} items, embedding dims ${sample.dish.embedding.length}, hash ${ingestion.contentHash.slice(0, 12)}`);
      continue;
    }

    const result = await repository.ingest(ingestion);
    if (result.created) created += 1; else reused += 1;
    console.log(`  ${result.created ? "stored" : "unchanged"} menu v${result.version} (${ingestion.items.length} items)`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Menus processed : ${restaurants.length - unmatched.length}`);
  console.log(`Dishes          : ${totalItems}`);
  if (!dryRun) console.log(`New versions    : ${created}   Unchanged: ${reused}`);
  if (unmatched.length) {
    console.log(`\nUnmatched venues (${unmatched.length}) - add to VENUE_NAME_OVERRIDES:`);
    for (const name of unmatched) console.log(`  - ${name}`);
  }
}

main().catch((error) => {
  console.error("\nIngestion failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
