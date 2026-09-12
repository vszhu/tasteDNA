import {
  inviteGroupSessionMember,
  respondToGroupSessionInvitation,
} from "@/lib/group-sessions/http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return inviteGroupSessionMember(request, sessionId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  return respondToGroupSessionInvitation(request, sessionId);
}
