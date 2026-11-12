import { NextRequest, NextResponse } from "next/server";

/**
 * team.eyeknow.app is the affiliates' PWA. Its root serves the
 * /team route (the affiliate dashboard in team dress), and the
 * legacy dashboard path on that host redirects to the team root.
 * Every other host serves the consumer app untouched, and only
 * these two paths are host-routed at all — APIs, assets, referral
 * links, and checkouts behave identically on every host.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  if (!host.startsWith("team.")) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/team";
    return NextResponse.rewrite(url);
  }
  if (pathname === "/affiliates") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/affiliates"] };
