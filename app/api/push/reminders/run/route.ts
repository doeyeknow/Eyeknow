import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { pushConfigured, runFirstBasicOffers, runUnlockReminders } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Send due unlock reminders and first-basic $1 offers. Called by
 *  Vercel Cron (vercel.json, hourly — the offer must land about an
 *  hour after the scan) with the CRON_SECRET bearer token Vercel
 *  injects once the variable exists; the same header works for a
 *  manual run. Without CRON_SECRET set, the route is closed —
 *  nobody can trigger sends by guessing the URL. Without the DB or
 *  VAPID keys configured, the run fails soft: it logs and reports
 *  not-configured, sends nothing, and never half-sends. */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dbConfigured() || !pushConfigured()) {
    console.warn("push reminders: not configured, skipping run");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const reminders = await runUnlockReminders();
  const offers = await runFirstBasicOffers();
  return NextResponse.json({ ok: true, reminders, offers });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
