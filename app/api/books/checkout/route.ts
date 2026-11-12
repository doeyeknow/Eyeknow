import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { BOOK_PRICE_CENTS, BOOKS, isBookSlug } from "@/lib/books";
import { normalizeRefCode } from "@/lib/affiliates";

export const dynamic = "force-dynamic";

/** Start a Stripe Checkout for one book PDF ($9.99, flat,
 *  server-side). Guest checkout is allowed, like the reading flow;
 *  a signed-in buyer gets the purchase in their account area too. */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Purchases aren't turned on yet — check back soon." },
      { status: 503 },
    );
  }
  const body = (await req.json().catch(() => null)) as { bookSlug?: string; ref?: string } | null;
  const bookSlug = body?.bookSlug ?? "";
  if (!isBookSlug(bookSlug)) {
    return NextResponse.json({ error: "unknown book" }, { status: 400 });
  }
  await ensureSchema();
  const user = await getSessionUser(req);
  const origin = req.nextUrl.origin;
  // Referral attribution for the $3.00-per-book affiliate share:
  // the code travels in metadata; the webhook resolves it, checks
  // buyer ≠ affiliate, and credits. The book price is $9.99 flat —
  // the reading-price slider and price cookie never touch it.
  const refCode = normalizeRefCode(body?.ref);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: BOOK_PRICE_CENTS,
          product_data: {
            name: `eyeKnow — ${BOOKS[bookSlug].title} (PDF)`,
            description: `The complete ${BOOKS[bookSlug].title} as a PDF download.`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      book: "1",
      bookSlug,
      userId: user?.id ?? "",
      ...(refCode ? { ref: refCode } : {}),
    },
    success_url: `${origin}/creator?book_bought=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/creator`,
  });
  return NextResponse.json({ url: session.url });
}
