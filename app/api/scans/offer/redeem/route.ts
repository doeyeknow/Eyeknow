import { NextRequest, NextResponse } from "next/server";
import { createSession, hashPassword, sessionCookie, verifyPassword } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import { markRevealCompleted, OFFER_WINDOW_MS } from "@/lib/firstBasicOffer";
import { getOfferEmailRow, scanIdForOfferLinkToken } from "@/lib/offerEmail";
import { scanCreatedAt } from "@/lib/push";
import { claimSharedScanToAccount, getSharedScanById } from "@/lib/shared";

export const dynamic = "force-dynamic";

/** Redeem an offer-email link (Adam, 2026-11-15 23:47 + 23:51):
 *  the signed token plus a password completes the reveal. No
 *  account for the email → create one with the existing auth
 *  system (same 8-character minimum, same bcrypt hash), sign in
 *  automatically, claim the scan, and set the reveal flag. An
 *  account already exists → the EXISTING password is required; the
 *  link alone never grants access to an existing account. The
 *  reveal does NOT unlock anything — the reading opens locked and
 *  the $1 purchase still happens at checkout through the existing
 *  server-priced path. After the 7-day window the same link still
 *  signs the person in and lands on the reading, at normal $3
 *  pricing (the offer-status endpoint prices from the offer row
 *  and the window, so an expired window simply shows $3).
 *
 *  Security: the token is validated server-side against its stored
 *  hash; an unknown token, or a token whose scan/email is gone,
 *  answers 404 with no scan data. No rate limit exists on the
 *  auth routes today, so none is added here either — the password
 *  step reuses the register/login checks exactly as they are. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Accounts are not configured yet." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as {
    token?: unknown;
    password?: unknown;
  } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!token) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }
  if (!password) {
    return NextResponse.json({ error: "Enter a password." }, { status: 400 });
  }
  await ensureSchema();
  const scanId = await scanIdForOfferLinkToken(token);
  if (!scanId) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }
  const emailRow = await getOfferEmailRow(scanId);
  const created = await scanCreatedAt(scanId);
  if (!emailRow || created === null) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }
  const expired = Date.now() >= created + OFFER_WINDOW_MS;
  const email = emailRow.email;
  const existing = await query<{ id: string; password_hash: string | null; google_sub: string | null }>(
    `SELECT id, password_hash, google_sub FROM iris_users WHERE email = $1`,
    [email],
  );
  const row = existing[0];
  let userId: string;
  let status = 200;
  if (!row) {
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    const passwordHash = await hashPassword(password);
    const rows = await query<{ id: string }>(
      `INSERT INTO iris_users (email, password_hash) VALUES ($1, $2) RETURNING id`,
      [email, passwordHash],
    );
    userId = rows[0].id;
    status = 201;
  } else {
    if (!row.password_hash && row.google_sub) {
      return NextResponse.json(
        { error: "This account signs in with Google — sign in with Google on the home page, then open this link again." },
        { status: 401 },
      );
    }
    if (!row.password_hash || !(await verifyPassword(password, row.password_hash))) {
      return NextResponse.json({ error: "Email or password didn't match." }, { status: 401 });
    }
    userId = row.id;
  }
  // The link flow completed: claim the scan into the account (the
  // shared claim path, idempotent — a second redemption of the same
  // link re-merges instead of duplicating) and set the reveal flag
  // that gates stage 2. A scan with no shared copy has nothing to
  // claim; the landing still works from the account/local copy.
  const shared = await getSharedScanById(scanId);
  if (shared) await claimSharedScanToAccount(userId, shared);
  await markRevealCompleted(scanId);
  const { token: sessionToken, maxAge } = await createSession(userId);
  return NextResponse.json(
    { user: { id: userId, email }, scanId, expired },
    { status, headers: { "Set-Cookie": sessionCookie(sessionToken, maxAge) } },
  );
}
