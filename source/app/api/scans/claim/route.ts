import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import { getSharedScan } from "@/lib/shared";

export const dynamic = "force-dynamic";

/** Save a shared reading (opened via its QR link) into the signed-in
 *  account. Its unlock state comes along — this is how a guest
 *  purchase becomes an account reading. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    scanId?: string;
    accessToken?: string;
  } | null;
  const shared = await getSharedScan(body?.scanId ?? "", body?.accessToken ?? "");
  if (!shared) return NextResponse.json({ error: "reading not found" }, { status: 404 });
  await ensureSchema();
  await query(
    `INSERT INTO iris_scans (user_id, scan_id, created_at, data, unlocked, unlocked_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 THEN now() ELSE NULL END)
     ON CONFLICT (user_id, scan_id) DO UPDATE
       SET unlocked = iris_scans.unlocked OR EXCLUDED.unlocked,
           unlocked_at = COALESCE(iris_scans.unlocked_at, EXCLUDED.unlocked_at)`,
    [user.id, shared.id, shared.createdAt, JSON.stringify(shared), Boolean(shared.unlocked)],
  );
  return NextResponse.json({ ok: true, unlocked: Boolean(shared.unlocked) });
}
