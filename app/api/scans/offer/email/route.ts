import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import { validEmail } from "@/lib/emailGate";
import { OFFER_WINDOW_MS } from "@/lib/firstBasicOffer";
import { resolveOfferEmail, saveOfferEmail } from "@/lib/offerEmail";
import { personSettled, scanCreatedAt } from "@/lib/push";
import { getSharedScan } from "@/lib/shared";

export const dynamic = "force-dynamic";

/** Offer-email capture (Adam, 2026-11-15 23:45 + 23:46): the email
 *  the two-stage funnel sends its links to. The first-scan gate is
 *  the primary capture; this route serves the unlock-panel fallback
 *  field (people who scanned before the gate, guests who cleared
 *  storage) and the exit beacon's attached gate address. Latest
 *  entry wins; the stored email is used ONLY for these links.
 *  Authorized the same two ways as the offer routes: the signed-in
 *  owner of an account reading, or the shared reading's access
 *  token. Anything else answers 404 — no oracle for whether a
 *  reading carries an email. */
async function authorized(req: NextRequest, scanId: string, accessToken: string): Promise<boolean> {
  const user = await getSessionUser(req);
  if (user) {
    const own = await query<{ scan_id: string }>(
      `SELECT scan_id FROM iris_scans WHERE user_id = $1 AND scan_id = $2`,
      [user.id, scanId],
    );
    if (own.length > 0) return true;
  }
  if (accessToken) {
    return Boolean(await getSharedScan(scanId, accessToken));
  }
  return false;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    scanId?: unknown;
    accessToken?: unknown;
    email?: unknown;
  } | null;
  const scanId = typeof body?.scanId === "string" ? body.scanId : "";
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
  const email = typeof body?.email === "string" ? body.email : "";
  if (!scanId) {
    return NextResponse.json({ error: "missing scan" }, { status: 400 });
  }
  if (!validEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!dbConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  await ensureSchema();
  if (!(await authorized(req, scanId, accessToken))) {
    return NextResponse.json({ error: "reading not found" }, { status: 404 });
  }
  await saveOfferEmail(scanId, email);
  return NextResponse.json({ ok: true });
}

/** Does this scan have an email on file, and is the funnel still
 *  relevant for it? The panel field shows only when relevant and
 *  no email is on file — an account email counts as on file, so
 *  signed-in readers never see the field. */
export async function GET(req: NextRequest) {
  const scanId = req.nextUrl.searchParams.get("scanId") ?? "";
  const accessToken = req.nextUrl.searchParams.get("t") ?? "";
  if (!scanId) {
    return NextResponse.json({ error: "missing scan" }, { status: 400 });
  }
  if (!dbConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  await ensureSchema();
  if (!(await authorized(req, scanId, accessToken))) {
    return NextResponse.json({ error: "reading not found" }, { status: 404 });
  }
  const hasEmail = (await resolveOfferEmail(scanId)) !== null;
  const created = await scanCreatedAt(scanId);
  const relevant =
    created !== null && Date.now() < created + OFFER_WINDOW_MS && !(await personSettled(scanId));
  return NextResponse.json({ hasEmail, relevant });
}
