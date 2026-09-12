import { listFriendships, requestFriendship } from "@/lib/friendships/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return listFriendships();
}

export async function POST(request: Request) {
  return requestFriendship(request);
}

