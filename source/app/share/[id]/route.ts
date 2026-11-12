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
 * Per-post share links: eyeknow.app/share/<post>?ref=<code>.
 *
 * Why this exists: when a link is posted to Facebook, X, or
 * WhatsApp, the picture in the preview comes from the shared
 * page's own Open Graph tags — the sharer cannot choose it. So
 * each affiliate post gets its own share link whose page carries
 * THAT post's picture (public/share-art/<post>.jpg, the generic
 * version of the post art) as its og:image, with the post's
 * headline as the preview title. The affiliate's ref rides the
 * query; a valid one sets the same referral cookies the
 * eyeknow.app/<username> route sets (and records the click), so
 * attribution is identical to sharing the raw link.
 *
 * This must be a 200 page, never a redirect: crawlers follow
 * redirects and would read the TARGET's tags instead. Human
 * visitors are moved on by script (crawlers don't run it), with
 * a visible button as the no-JS fallback.
 */
const POSTS: Record<string, { title: string; description: string; target: string }> = {
  reading: {
    title: "eyeKnow — Traditional Iridology Readings",
    description:
      "Your eyes tell a story. eyeKnow reads the signs in your iris on a traditional iridology chart — a full report from one photo of your eye.",
    target: "/",
  },
  preview: {
    title: "See the top signs in your iris — free preview",
    description: "Get a free preview of the top signs in your iris with eyeKnow — no cost to look.",
    target: "/",
  },
  freescans: {
    title: "Buy a reading, get 10 free readings to share",
    description: "Buy a full eyeKnow reading and get 10 free readings to share with friends and family.",
    target: "/",
  },
  gift: {
    title: "Send an eyeKnow reading as a gift",
    description:
      "Send someone a full eyeKnow iris reading as a gift — it arrives as a link and unlocks in full for them.",
    target: "/",
  },
  books: {
    title: "Books by Kyle Jacob Butler",
    description:
      "Two books by Kyle Jacob Butler, the eyeKnow developer — The Ground We Stand On and The Trouble with English, instant downloads.",
    target: "/creator",
  },
  timeline: {
    title: "Start your eyeKnow Timeline",
    description:
      "One reading is a snapshot — the eyeKnow Timeline makes it a story, comparing every new scan of your iris with the last.",
    target: "/",
  },
  subscription: {
    title: "A reading of each iris, every week",
    description:
      "A full reading of each iris every week, a comprehensive Timeline report, and a personal overview by a real person each month.",
    target: "/",
  },
  bodymap: {
    title: "Your findings on an interactive body map",
    description: "Your eyeKnow findings lit up on an interactive body map — tap a lit area and its signs pop up.",
    target: "/",
  },
  diet: {
    title: "Diet recommendations from your iris reading",
    description:
      "Traditional diet recommendations built from your constitution and the areas your signs highlight — real foods, everyday eating.",
    target: "/",
  },
  constitution: {
    title: "What's your constitution type?",
    description:
      "Blue, brown, or mixed — your iris colour carries your traditional constitution type. Find out yours with eyeKnow.",
    target: "/",
  },
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const post = POSTS[params.id];
  if (!post) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  const origin = "https://eyeknow.app";
  const image = `${origin}/share-art/${params.id}.jpg`;
  const pageUrl = `${origin}/share/${params.id}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(post.title)}</title>
<meta name="description" content="${esc(post.description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="eyeKnow" />
<meta property="og:title" content="${esc(post.title)}" />
<meta property="og:description" content="${esc(post.description)}" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1080" />
<meta property="og:image:height" content="1080" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(post.title)}" />
<meta name="twitter:description" content="${esc(post.description)}" />
<meta name="twitter:image" content="${image}" />
<style>
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #0d3b37; color: #f3ead8;
         display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  main { text-align: center; padding: 32px 20px; max-width: 430px; }
  img { width: 240px; height: 240px; border-radius: 14px; box-shadow: 0 12px 32px rgba(0,0,0,.35); }
  h1 { font-size: 1.35rem; line-height: 1.35; margin: 22px 0 10px; }
  p { font-family: system-ui, sans-serif; font-size: .95rem; opacity: .85; line-height: 1.5; }
  a.btn { display: inline-block; margin-top: 14px; background: #c9a227; color: #17251f; font-family: system-ui, sans-serif;
          font-weight: 700; text-decoration: none; padding: 12px 22px; border-radius: 999px; }
</style>
<script>location.replace(${JSON.stringify(post.target)});</script>
</head>
<body>
<main>
  <img src="${image}" alt="" />
  <h1>${esc(post.title)}</h1>
  <p>${esc(post.description)}</p>
  <a class="btn" href="${post.target}">Continue to eyeKnow</a>
</main>
</body>
</html>`;
  const res = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  // Attribution: a valid ref sets the standard referral cookies on
  // this response, exactly as the /<username> route does.
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  if (ref) {
    try {
      if (dbConfigured()) {
        const hit = await recordAffiliateClick(ref);
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
      // Attribution must never break the landing.
    }
  }
  return res;
}
