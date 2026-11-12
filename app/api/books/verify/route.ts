import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import {
  BOOK_PRICE_CENTS,
  BOOKS,
  bookDownloadToken,
  bookDownloadUrl,
  getBookDownloadBySession,
  isBookSlug,
} from "@/lib/books";

export const dynamic = "force-dynamic";

/** After Stripe redirects back from a book purchase: confirm
 *  payment server-side and hand back the download link. The row
 *  itself is created ONLY by the webhook; when it hasn't landed
 *  yet this reports settling (the buyer retries) rather than
 *  minting access. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "purchases not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
  const sessionId = body?.sessionId ?? "";
  if (!sessionId) return NextResponse.json({ error: "missing session" }, { status: 400 });
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const bookSlug = session.metadata?.bookSlug ?? "";
  if (
    session.metadata?.book !== "1" ||
    session.payment_status !== "paid" ||
    !isBookSlug(bookSlug) ||
    (session.amount_total ?? 0) < BOOK_PRICE_CENTS
  ) {
    return NextResponse.json({ ok: false, error: "payment not confirmed" }, { status: 402 });
  }
  const row = await getBookDownloadBySession(sessionId);
  if (!row) {
    return NextResponse.json({ ok: false, settling: true });
  }
  return NextResponse.json({
    ok: true,
    bookSlug: row.book_slug,
    title: BOOKS[row.book_slug as keyof typeof BOOKS].title,
    downloadUrl: bookDownloadUrl(req.nextUrl.origin, bookDownloadToken(row.id)),
  });
}
