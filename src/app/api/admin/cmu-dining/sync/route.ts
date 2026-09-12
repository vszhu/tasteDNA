import { NextResponse } from "next/server";
import { isAuthorizedCmuSyncRequest } from "@/lib/cmu-dining/admin";
import { SupabaseCmuVenueRepository } from "@/lib/cmu-dining/repository";
import { syncCmuDiningVenues } from "@/lib/cmu-dining/sync";
import { getSupabaseAdminClient } from "@/lib/db/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const syncSecret = process.env.CMU_DINING_SYNC_SECRET;
  if (!syncSecret) {
    return NextResponse.json({ error: "CMU Dining sync is not configured." }, { status: 503 });
  }
  if (!isAuthorizedCmuSyncRequest(request, syncSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase persistence is not configured." }, { status: 503 });
  }

  try {
    const result = await syncCmuDiningVenues(new SupabaseCmuVenueRepository(client));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "CMU Dining sync failed." }, { status: 502 });
  }
}
