import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import {
  getReviewQueue,
  submitOverview,
} from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

function reviewerToken(req: NextRequest): string | null {
  return req.headers.get("x-subscription-reviewer-token");
}

/**
 * Reviewer workflow — real people only, token-guarded, fail-closed:
 *
 * GET (review queue): every active subscriber's current-month
 * overview slot, with whether it is written yet.
 * POST (submit): store one month's human-written overview text.
 *
 * The token comes from the x-subscription-reviewer-token header and
 * must match the SUBSCRIPTION_REVIEWER_TOKEN env var. When the env
 * var is unset, every request is denied — there is no fallback and
 * no default token. Overview text is stored and displayed verbatim;
 * the server never generates overview prose.
 */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const result = await getReviewQueue(reviewerToken(req));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ entries: result.entries });
}

export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as {
    subscriptionId?: string;
    monthStart?: string;
    text?: string;
  } | null;
  const result = await submitOverview({
    token: reviewerToken(req),
    subscriptionId: body?.subscriptionId ?? "",
    monthStart: body?.monthStart ?? "",
    text: body?.text ?? "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}
