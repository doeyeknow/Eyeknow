import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { pushConfigured, runUnlockReminders } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Send due unlock reminders. Called by Vercel Cron (vercel.json,
 *  daily) with the CRON_SECRET bearer token Vercel injects once the
 *  variable exists; the same header works for a manual run. Without
 *  CRON_SECRET set, the route is closed — nobody can trigger sends
 *  by guessing the URL. */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dbConfigured() || !pushConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const result = await runUnlockReminders();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
