import { NextRequest, NextResponse } from "next/server";
import { createSession, hashPassword, sessionCookie } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Accounts are not configured yet." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = (body?.email ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  await ensureSchema();
  const existing = await query(`SELECT id FROM iris_users WHERE email = $1`, [email]);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "An account with that email already exists — try signing in." },
      { status: 409 },
    );
  }
  const passwordHash = await hashPassword(password);
  const rows = await query<{ id: string }>(
    `INSERT INTO iris_users (email, password_hash) VALUES ($1, $2) RETURNING id`,
    [email, passwordHash],
  );
  const user = { id: rows[0].id, email };
  const { token, maxAge } = await createSession(user.id);
  return NextResponse.json(
    { user },
    { status: 201, headers: { "Set-Cookie": sessionCookie(token, maxAge) } },
  );
}
