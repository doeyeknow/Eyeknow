import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import {
  REFERRAL_COOKIE,
  REFERRAL_PRICE_COOKIE,
  REFERRAL_TTL_DAYS,
  recordAffiliateClick,
} from "@/lib/affiliates";

export const dynamic = "force-dynamic";

/**
 * Clean affiliate path links: eyeknow.app/<username>, where the name
 * is the affiliate's custom slug — or their auto-generated code,
 * which works as a path too. On a match this sets the referral
 * cookie (canonical code + current price, 30 days), records one
 * click (no IP/user-agent PII), and redirects to the homepage. On
 * NO match it redirects to the homepage with no referral and no
 * error page — never a 404 for a mistyped name.
 *
 * This is a route handler (not a page) because cookies set in a
 * page component are dropped when the page then redirects, while a
 * handler can attach them to the redirect response itself.
 *
 * Route safety: static routes always win over this dynamic segment
 * in the App Router, so /affiliates, /creator, and every other real
 * page are never swallowed — and the reserved-slug validation on
 * slug save (affiliates, creator, api, auth, admin, login, register,
 * scan, reading, books, checkout, webhook, static, public, _next,
 * plus any route slug) means no affiliate can claim one of those
 * names in the first place. /api/* lives in its own route tree, and
 * public files (icons, manifest) are served before routing.
 */
export async function GET(req: NextRequest, { params }: { params: { username: string } }) {
  const res = NextResponse.redirect(new URL("/", req.url));
  try {
    if (dbConfigured()) {
      const hit = await recordAffiliateClick(params.username ?? "");
      if (hit) {
        const maxAge = REFERRAL_TTL_DAYS * 24 * 60 * 60;
        res.cookies.set(REFERRAL_COOKIE, hit.code, { path: "/", maxAge, sameSite: "lax" });
        res.cookies.set(REFERRAL_PRICE_COOKIE, String(hit.priceCents), {
          path: "/",
          maxAge,
          sameSite: "lax",
        });
      }
    }
  } catch {
    // A path link must never error: fall through to the homepage.
  }
  return res;
}
