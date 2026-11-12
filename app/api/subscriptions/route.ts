import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { getSubscriptionStatus } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/** The signed-in user's Timeline subscription status (term, window,
 *  scans remaining per iris this year, monthly overview slots), or
 *  { subscription: null } when they have none. */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const subscription = await getSubscriptionStatus(user.id);
  return NextResponse.json({ subscription });
}
