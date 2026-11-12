import { cookies } from "next/headers";
import { getSessionUserByToken, SESSION_COOKIE } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import AffiliatesDashboard from "@/components/AffiliatesDashboard";
import AffiliateSignIn from "@/components/AffiliateSignIn";

export const dynamic = "force-dynamic";

/** The affiliate dashboard is signed-in only. Logged-out visitors
 *  never receive any dashboard content — no link, no slider, no
 *  stats, no earnings copy — just the sign-in panel, which returns
 *  them to this page on success. Referral links, cookies, click
 *  tracking, and referred checkouts are untouched: they live outside
 *  this page and keep working for logged-out visitors. */
export default async function AffiliatesPage() {
  let authed = false;
  if (dbConfigured()) {
    try {
      authed = (await getSessionUserByToken(cookies().get(SESSION_COOKIE)?.value)) !== null;
    } catch {
      authed = false;
    }
  }
  if (authed) return <AffiliatesDashboard />;
  return (
    <div className="app">
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 80px" }}>
        <p>
          <a href="/">← Back to eyeKnow</a>
        </p>
        <h1 style={{ marginTop: 0 }}>Affiliates</h1>
        <p>Sign in is required to join the affiliate program.</p>
        <AffiliateSignIn />
        <p className="muted" style={{ marginTop: 28 }}>
          eyeKnow — traditional iridology readings for interest and self-reflection. Not medical
          advice.
        </p>
      </main>
    </div>
  );
}
