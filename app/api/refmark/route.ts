import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { resolveAffiliate } from "@/lib/affiliates";
import { isValidRefValue } from "@/lib/affiliates-client";
import { REFMARK_PNG_BASE64 } from "@/lib/refmarkImage";
import { REFMARK_KEY, injectPngText } from "@/lib/refmark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The refmark image (Adam, 2026-11-05): the logo icon, served
 * two ways from one URL so the browser's HTTP cache can act as
 * the third referral fallback layer.
 *
 *  - GET /api/refmark (header x-refmark-code: <ref>) — called
 *    right after a referral capture with fetch(cache:"reload").
 *    When the reference
 *    resolves to a real affiliate, the response is the logo
 *    with the affiliate's canonical CODE stamped into a PNG
 *    tEXt chunk (never a price — checkout resolves price from
 *    the code server-side), Cache-Control private for 30 days,
 *    so the browser files the stamped copy under this URL.
 *  - GET /api/refmark — called on later visits with
 *    fetch(cache:"force-cache") when cookie + localStorage are
 *    both empty. A surviving cache entry returns the stamped
 *    bytes and the page reads the code back; a cache miss lands
 *    here and gets the plain logo on a short cache (nothing to
 *    recover, and a long-lived generic copy must never sit in
 *    the slot a stamped copy needs).
 */
export async function GET(req: NextRequest) {
  const base = new Uint8Array(Buffer.from(REFMARK_PNG_BASE64, "base64"));
  // The code arrives OUTSIDE the URL (header, or the referral
  // cookie set moments before): stamp and recovery must share
  // the exact same URL, because the browser's HTTP cache keys
  // entries by full URL — a ?c= variant would file the stamped
  // copy under an address recovery never asks for.
  const c = (
    req.headers.get("x-refmark-code") ??
    req.cookies.get("iris_ref")?.value ??
    req.nextUrl.searchParams.get("c") ??
    ""
  )
    .trim()
    .toLowerCase();
  let body: Uint8Array = base;
  let maxAge = 300;
  if (c && isValidRefValue(c)) {
    let code: string | null = null;
    if (dbConfigured()) {
      const aff = await resolveAffiliate(c).catch(() => null);
      code = aff?.code ?? null;
    } else {
      // No database (local dev): accept the format-valid value,
      // mirroring the click route's dbConfigured() pattern. In
      // production the database is always configured, so the
      // strict resolution above is the only path that runs.
      code = c;
    }
    if (code) {
      body = injectPngText(base, REFMARK_KEY, code);
      maxAge = 30 * 24 * 60 * 60;
    }
  }
  return new NextResponse(Buffer.from(body), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": `private, max-age=${maxAge}`,
    },
  });
}
