import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { offerEmailConfigured, runOfferEmails } from "@/lib/offerEmail";
import { pushConfigured, runFirstBasicOffers, runUnlockReminders } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Sweep backstop for unlock reminders and the two-stage $1 offer
 *  funnel (push + email). Called by Vercel Cron (vercel.json, daily
 *  — the Hobby plan allows one run a day) and by an external hourly
 *  pinger, with the CRON_SECRET bearer token; the same header works
 *  for a manual run. Without CRON_SECRET set, the route is closed —
 *  nobody can trigger sends by guessing the URL. Each channel runs
 *  only when its own config exists (VAPID keys for push, Resend key
 *  for email); with neither configured the run fails soft: it logs
 *  and reports not-configured, sends nothing, and never half-sends.
 *  A null result for a channel means that channel is unconfigured. */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dbConfigured() || (!pushConfigured() && !offerEmailConfigured())) {
    console.warn("push reminders: not configured, skipping run");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const reminders = pushConfigured() ? await runUnlockReminders() : null;
  const offers = pushConfigured() ? await runFirstBasicOffers() : null;
  const emails = offerEmailConfigured() ? await runOfferEmails() : null;
  return NextResponse.json({ ok: true, reminders, offers, emails });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
