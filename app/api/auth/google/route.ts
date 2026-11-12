import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { dbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Start Google sign-in: redirect to Google's consent screen.
 *  A scan id can ride along (paywall flow) so the reading reopens
 *  after sign-in. */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!dbConfigured() || !clientId) {
    return NextResponse.redirect(new URL("/?auth=unavailable", req.nextUrl.origin));
  }
  const state = randomBytes(16).toString("hex");
  const scan = req.nextUrl.searchParams.get("scan") ?? "";
  const origin = req.nextUrl.origin;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  const cookieOpts = "Path=/; Max-Age=600; HttpOnly; SameSite=Lax" + (process.env.NODE_ENV === "production" ? "; Secure" : "");
  res.headers.append("Set-Cookie", `iris_oauth_state=${state}; ${cookieOpts}`);
  if (scan) {
    res.headers.append("Set-Cookie", `iris_oauth_scan=${encodeURIComponent(scan)}; ${cookieOpts}`);
  }
  return res;
}
