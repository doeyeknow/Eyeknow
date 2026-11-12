import { NextRequest, NextResponse } from "next/server";
import { clearedSessionCookie, getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Delete the signed-in account and everything in it (readings,
 *  unlocks, sessions) via cascade. */
export async function DELETE(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  await ensureSchema();
  await query(`DELETE FROM iris_users WHERE id = $1`, [user.id]);
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": clearedSessionCookie() } },
  );
}
