import { createHash, createHmac } from "crypto";
import { ensureSchema, hashAccessToken, query } from "./db";

/** Book store: three PDF books by Kyle Jacob Butler, $9.99 each.
 *  Price is flat and server-side (never accepted from the client).
 *  Fulfillment runs ONLY through the Stripe webhook on a paid
 *  session, idempotent on stripe_session_id: one paid session
 *  creates exactly one download row. The buyer recovers the
 *  download link any time (account area, or the checkout-verify
 *  response) because the token is derived deterministically from
 *  the row id — only the hash is stored, same model as the
 *  early-supporter gift links. The PDFs themselves ship split
 *  into small parts (see split-book-pdfs.py) because the deploy
 *  uploader caps single files; the download route reassembles
 *  them and streams the byte-identical original. */

export const BOOK_PRICE_CENTS = 999;

export const BOOKS = {
  "the-ground-you-stand-on": {
    title: "The Ground We Stand On",
    fileDir: "the-ground-you-stand-on",
    downloadName: "the-ground-you-stand-on.pdf",
  },
  "the-trouble-with-english": {
    title: "The Trouble with English",
    fileDir: "the-trouble-with-english",
    downloadName: "the-trouble-with-english.pdf",
  },
  "dope-sick": {
    title: "Dope Sick",
    fileDir: "dope-sick",
    downloadName: "dope-sick.pdf",
  },
} as const;

export type BookSlug = keyof typeof BOOKS;

export function isBookSlug(s: string): s is BookSlug {
  return s === "the-ground-you-stand-on" || s === "the-trouble-with-english" || s === "dope-sick";
}

export function bookDownloadToken(rowId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) {
    return createHmac("sha256", secret).update(`book:${rowId}`).digest("hex");
  }
  return createHash("sha256").update(`book:${rowId}`).digest("hex");
}

export function bookDownloadUrl(origin: string, token: string): string {
  return `${origin}/api/books/download?token=${encodeURIComponent(token)}`;
}

export interface BookDownloadRow {
  id: string;
  book_slug: string;
  stripe_session_id: string;
  created_at: string;
}

/** Webhook-only fulfillment: insert the download row for a paid
 *  book session, or do nothing when it already exists. */
export async function recordBookPurchase(
  userId: string | null,
  bookSlug: BookSlug,
  stripeSessionId: string,
): Promise<{ created: boolean }> {
  await ensureSchema();
  const id = `${bookSlug}:${stripeSessionId}`;
  const rows = await query<{ id: string }>(
    `INSERT INTO iris_book_downloads (id, token_hash, user_id, book_slug, stripe_session_id)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (stripe_session_id) DO NOTHING RETURNING id`,
    [id, hashAccessToken(bookDownloadToken(id)), userId, bookSlug, stripeSessionId],
  );
  return { created: rows.length > 0 };
}

export async function getBookDownloadBySession(
  stripeSessionId: string,
): Promise<BookDownloadRow | null> {
  await ensureSchema();
  const rows = await query<BookDownloadRow>(
    `SELECT id, book_slug, stripe_session_id, created_at
     FROM iris_book_downloads WHERE stripe_session_id = $1`,
    [stripeSessionId],
  );
  return rows[0] ?? null;
}

export async function getBookDownloadByToken(token: string): Promise<BookDownloadRow | null> {
  if (!token) return null;
  await ensureSchema();
  const rows = await query<BookDownloadRow>(
    `SELECT id, book_slug, stripe_session_id, created_at
     FROM iris_book_downloads WHERE token_hash = $1`,
    [hashAccessToken(token)],
  );
  return rows[0] ?? null;
}

export async function listBookDownloadsForUser(userId: string): Promise<BookDownloadRow[]> {
  await ensureSchema();
  return query<BookDownloadRow>(
    `SELECT id, book_slug, stripe_session_id, created_at
     FROM iris_book_downloads WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
}
