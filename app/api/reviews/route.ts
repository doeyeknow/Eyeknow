import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { createReview, listApprovedReviews } from "@/lib/reviews";

export const dynamic = "force-dynamic";

/** Public reviews: GET returns the owner-approved list for the
 *  homepage (empty until the first approval — the page then shows
 *  its starter reviews). POST accepts a visitor submission, held
 *  as pending for the owner's review in /admin. */
export async function GET() {
  if (!dbConfigured()) return NextResponse.json({ reviews: [] });
  try {
    const reviews = await listApprovedReviews();
    return NextResponse.json({ reviews });
  } catch {
    return NextResponse.json({ reviews: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Reviews aren't available right now." }, { status: 503 });
  }
  let body: { name?: unknown; context?: unknown; stars?: unknown; text?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const context = typeof body.context === "string" ? body.context.trim().slice(0, 60) : "";
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 1200) : "";
  const starsRaw = typeof body.stars === "number" ? Math.round(body.stars) : 5;
  const stars = Math.min(5, Math.max(1, starsRaw));
  if (name.length < 1) {
    return NextResponse.json({ error: "Please add your name." }, { status: 400 });
  }
  if (text.length < 10) {
    return NextResponse.json({ error: "Please write a little more about your reading." }, { status: 400 });
  }
  try {
    const user = await getSessionUser(req).catch(() => null);
    await createReview({
      name,
      context: context || null,
      stars,
      body: text,
      userId: user?.id ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save your review — try again in a moment." }, { status: 503 });
  }
}
