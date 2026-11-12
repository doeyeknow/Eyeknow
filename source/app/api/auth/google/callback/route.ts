import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookie } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
}

/** Google redirects here with a code; exchange it, find-or-create
 *  the account by verified email, start a session. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (why: string) =>
    NextResponse.redirect(new URL(`/?auth=error&why=${why}`, origin));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!dbConfigured() || !clientId || !clientSecret) return fail("unavailable");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get("iris_oauth_state")?.value;
  const scan = req.cookies.get("iris_oauth_scan")?.value ?? "";
  if (!code || !state || !stateCookie || state !== stateCookie) return fail("state");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("exchange");
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return fail("exchange");

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) return fail("userinfo");
  const info = (await infoRes.json()) as GoogleUserInfo;
  const email = (info.email ?? "").trim().toLowerCase();
  if (!email || info.email_verified === false) return fail("email");

  await ensureSchema();
  // Find by Google id first, then by email (linking a password
  // account with the same verified email), else create.
  let rows = await query<{ id: string }>(`SELECT id FROM iris_users WHERE google_sub = $1`, [info.sub]);
  if (rows.length === 0) {
    rows = await query<{ id: string }>(`SELECT id FROM iris_users WHERE email = $1`, [email]);
    if (rows.length > 0) {
      await query(`UPDATE iris_users SET google_sub = $1 WHERE id = $2`, [info.sub, rows[0].id]);
    } else {
      rows = await query<{ id: string }>(
        `INSERT INTO iris_users (email, google_sub) VALUES ($1, $2) RETURNING id`,
        [email, info.sub],
      );
    }
  }
  const { token, maxAge } = await createSession(rows[0].id);
  const target = scan ? `/?scan=${encodeURIComponent(scan)}` : "/";
  const res = NextResponse.redirect(new URL(target, origin));
  res.headers.append("Set-Cookie", sessionCookie(token, maxAge));
  res.headers.append("Set-Cookie", "iris_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  res.headers.append("Set-Cookie", "iris_oauth_scan=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  return res;
}
