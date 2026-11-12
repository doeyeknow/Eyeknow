import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  if (!dbConfigured()) return NextResponse.json({ configured: false, user: null, admin: false, googleConfigured });
  const user = await getSessionUser(req).catch(() => null);
  return NextResponse.json({ configured: true, user, admin: isAdminUser(user), googleConfigured });
}
