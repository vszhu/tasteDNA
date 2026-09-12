import { updateGroupSessionMealPreferences } from "@/lib/group-sessions/http";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return updateGroupSessionMealPreferences(request, sessionId);
}
