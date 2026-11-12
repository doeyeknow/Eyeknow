import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { dbConfigured } from "@/lib/db";
import { BOOKS, getBookDownloadByToken, isBookSlug } from "@/lib/books";

export const dynamic = "force-dynamic";

/** Stream a purchased book PDF to its buyer. The token in the
 *  link is the credential (same trust model as gift links). The
 *  PDFs ship split into small parts (deploy uploader cap), so the
 *  parts are reassembled here and streamed — the buyer receives
 *  the byte-identical original. */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const row = await getBookDownloadByToken(token);
  if (!row || !isBookSlug(row.book_slug)) {
    return NextResponse.json({ error: "download not found" }, { status: 404 });
  }
  const book = BOOKS[row.book_slug];
  const dir = path.join(process.cwd(), "books", book.fileDir);
  let parts: string[];
  try {
    parts = (await fs.readdir(dir))
      .filter((f) => f.endsWith(".part"))
      .sort();
  } catch {
    return NextResponse.json({ error: "download unavailable" }, { status: 503 });
  }
  if (parts.length === 0) {
    return NextResponse.json({ error: "download unavailable" }, { status: 503 });
  }
  let total = 0;
  for (const p of parts) {
    total += (await fs.stat(path.join(dir, p))).size;
  }
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const p of parts) {
          controller.enqueue(await fs.readFile(path.join(dir, p)));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${book.downloadName}"`,
      "Content-Length": String(total),
    },
  });
}
