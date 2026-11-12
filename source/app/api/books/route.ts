import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { BOOKS, bookDownloadToken, bookDownloadUrl, listBookDownloadsForUser } from "@/lib/books";

export const dynamic = "force-dynamic";

/** A signed-in buyer's book purchases, with download links. */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const rows = await listBookDownloadsForUser(user.id);
  return NextResponse.json({
    books: rows
      .filter((r) => r.book_slug in BOOKS)
      .map((r) => ({
        bookSlug: r.book_slug,
        title: BOOKS[r.book_slug as keyof typeof BOOKS].title,
        downloadUrl: bookDownloadUrl(req.nextUrl.origin, bookDownloadToken(r.id)),
        purchasedAt: r.created_at,
      })),
  });
}
