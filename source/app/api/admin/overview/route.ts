import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { getAdminOverview, isAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Site-owner overview: every affiliate and their sales.
 *  Fail-closed — unauthenticated → 401, signed-in non-owner → 403.
 *  Only the owner emails in lib/admin.ts ever see this data. */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  if (!isAdminUser(user)) return NextResponse.json({ error: "owner only" }, { status: 403 });
  try {
    const overview = await getAdminOverview();
    return NextResponse.json(overview);
  } catch {
    return NextResponse.json({ error: "database unavailable" }, { status: 503 });
  }
}
