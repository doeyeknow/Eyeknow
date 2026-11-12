import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookie, verifyPassword } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Accounts are not configured yet." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  await ensureSchema();
  const rows = await query<{ id: string; password_hash: string | null; google_sub: string | null }>(
    `SELECT id, password_hash, google_sub FROM iris_users WHERE email = $1`,
    [email],
  );
  const row = rows[0];
  if (row && !row.password_hash && row.google_sub) {
    return NextResponse.json(
      { error: "This account signs in with Google — use the Google button." },
      { status: 401 },
    );
  }
  if (!row || !row.password_hash || !(await verifyPassword(password, row.password_hash))) {
    return NextResponse.json({ error: "Email or password didn't match." }, { status: 401 });
  }
  const user = { id: row.id, email };
  const { token, maxAge } = await createSession(user.id);
  return NextResponse.json(
    { user },
    { headers: { "Set-Cookie": sessionCookie(token, maxAge) } },
  );
}
