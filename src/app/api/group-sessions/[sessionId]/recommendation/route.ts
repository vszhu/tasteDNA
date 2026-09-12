import {
  computeGroupSession,
  readLatestGroupSessionRecommendation,
} from "@/lib/group-sessions/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return readLatestGroupSessionRecommendation(sessionId);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return computeGroupSession(sessionId);
}
