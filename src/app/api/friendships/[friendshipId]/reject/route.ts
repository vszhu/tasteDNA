import { respondToFriendship } from "@/lib/friendships/http";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ friendshipId: string }> },
) {
  const { friendshipId } = await params;
  return respondToFriendship(friendshipId, "reject");
}

