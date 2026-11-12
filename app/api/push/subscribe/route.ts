import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { pushConfigured, saveSubscription, validSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Store this device's push subscription and (when a scan is named)
 *  arm its unlock reminder. Opt-in only: the browser sends this
 *  after the user granted notification permission. Fails closed —
 *  503 until the VAPID keys exist in the environment. */
export async function POST(req: NextRequest) {
  if (!dbConfigured() || !pushConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as {
    subscription?: unknown;
    scanId?: unknown;
  } | null;
  if (!body || !validSubscription(body.subscription)) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }
  const scanId = typeof body.scanId === "string" && body.scanId ? body.scanId : null;
  const user = await getSessionUser(req).catch(() => null);
  await saveSubscription(body.subscription, scanId, user?.id ?? null);
  return NextResponse.json({ ok: true });
}
