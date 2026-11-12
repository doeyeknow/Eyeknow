import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";
import { listReviewsForAdmin, setReviewStatus } from "@/lib/reviews";

export const dynamic = "force-dynamic";

/** Owner-only review moderation (Adam, 2026-11-05): submissions
 *  from the homepage reviews section land here as 'pending';
 *  approving one puts it on the homepage, rejecting hides it for
 *  good. Fail-closed like the overview route. */
async function gate(req: NextRequest) {
  if (!dbConfigured()) return { error: NextResponse.json({ error: "not configured" }, { status: 503 }) };
  const user = await getSessionUser(req);
  if (!user) return { error: NextResponse.json({ error: "sign in required" }, { status: 401 }) };
  if (!isAdminUser(user)) return { error: NextResponse.json({ error: "owner only" }, { status: 403 }) };
  return { user };
}

export async function GET(req: NextRequest) {
  const g = await gate(req);
  if (g.error) return g.error;
  try {
    const reviews = await listReviewsForAdmin();
    return NextResponse.json({ reviews });
  } catch {
    return NextResponse.json({ error: "database unavailable" }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const g = await gate(req);
  if (g.error) return g.error;
  let body: { id?: unknown; status?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const ok = await setReviewStatus(id, status);
    if (!ok) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "database unavailable" }, { status: 503 });
  }
}
