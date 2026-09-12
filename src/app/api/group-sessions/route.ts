import { createGroupSession } from "@/lib/group-sessions/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return createGroupSession(request);
}
