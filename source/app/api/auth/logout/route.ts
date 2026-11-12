import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, clearedSessionCookie, destroySession } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (dbConfigured()) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) await destroySession(token).catch(() => undefined);
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": clearedSessionCookie() } },
  );
}
