import { NextResponse, type NextRequest } from "next/server";
import { ensurePublicUser } from "@/lib/auth/bootstrap";
import { parseEmailOtpType, safeNextPath, signInPath } from "@/lib/auth/callback";
import { sessionUserFromSupabase } from "@/lib/auth/supabase-adapter";
import { createAuthenticatedSupabaseServerClient } from "@/lib/db/supabase-auth-server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = parseEmailOtpType(url.searchParams.get("type"));
  const client = await createAuthenticatedSupabaseServerClient();

  if (!client) return NextResponse.redirect(new URL(signInPath(next, "not-configured"), url.origin));

  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : tokenHash && otpType
      ? await client.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
      : { data: { user: null }, error: new Error("Missing auth callback parameters") };

  const user = result.data.user;
  if (result.error || !user) {
    return NextResponse.redirect(new URL(signInPath(next, "invalid-link"), url.origin));
  }

  await ensurePublicUser(client, sessionUserFromSupabase(user));
  return NextResponse.redirect(new URL(next, url.origin));
}
