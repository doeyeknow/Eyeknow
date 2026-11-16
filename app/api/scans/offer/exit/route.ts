import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import { sendExitEmails } from "@/lib/offerEmail";
import { sendExitPushPrompts } from "@/lib/push";
import { getSharedScan } from "@/lib/shared";

export const dynamic = "force-dynamic";

/** Exit-triggered funnel sends (Adam, 2026-11-15 23:42 + 23:51):
 *  the reading view reports that the person left without
 *  unlocking, and the server sends whichever stage applies,
 *  promptly: the stage-1 reveal prompt (push reminder + email with
 *  the signed link, no $1 mention, no offer row) before the reveal
 *  flag, the $1 offer (push + email, offer row created at the send)
 *  after it. Sends only when the reading is still locked, inside
 *  the 7-day window, and never sent before at that stage. An email
 *  attached by the beacon (the first-scan gate's address, stored on
 *  the device) is saved first so the email stage can use it.
 *  Authorized the same two ways as the offer-status route: the
 *  signed-in owner of an account reading, or the shared reading's
 *  access token. Anything else answers 404 — no oracle for whether
 *  a reading carries an offer.
 *
 *  Best effort by design: the caller is a beacon fired on page
 *  hide/unload, so this route never fails loudly. Push or email
 *  unconfigured, no armed subscription, no email on file, or an
 *  unexpected error all answer 200 with zero sent — the sweep
 *  retries whatever an exit report missed. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      scanId?: unknown;
      accessToken?: unknown;
      email?: unknown;
    } | null;
    const scanId = typeof body?.scanId === "string" ? body.scanId : "";
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
    const email = typeof body?.email === "string" ? body.email : undefined;
    if (!scanId) {
      return NextResponse.json({ ok: false, error: "missing scan" }, { status: 400 });
    }
    if (!dbConfigured()) {
      return NextResponse.json({
        ok: true,
        push: { revealSent: 0, offerSent: 0, skipped: 0, gone: 0 },
        email: { revealSent: 0, offerSent: 0, skipped: 0, failed: 0 },
      });
    }
    await ensureSchema();
    const user = await getSessionUser(req);
    let authorized = false;
    if (user) {
      const own = await query<{ scan_id: string }>(
        `SELECT scan_id FROM iris_scans WHERE user_id = $1 AND scan_id = $2`,
        [user.id, scanId],
      );
      authorized = own.length > 0;
    }
    if (!authorized && accessToken) {
      authorized = Boolean(await getSharedScan(scanId, accessToken));
    }
    if (!authorized) {
      return NextResponse.json({ ok: false, error: "reading not found" }, { status: 404 });
    }
    const push = await sendExitPushPrompts(scanId);
    const mail = await sendExitEmails(scanId, email);
    return NextResponse.json({ ok: true, push, email: mail });
  } catch {
    return NextResponse.json({
      ok: false,
      push: { revealSent: 0, offerSent: 0, skipped: 0, gone: 0 },
      email: { revealSent: 0, offerSent: 0, skipped: 0, failed: 0 },
    });
  }
}
