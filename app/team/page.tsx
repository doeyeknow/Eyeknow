import { cookies } from "next/headers";
import { getSessionUserByToken, SESSION_COOKIE } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import AffiliatesDashboard from "@/components/AffiliatesDashboard";
import AffiliateSignIn from "@/components/AffiliateSignIn";

export const dynamic = "force-dynamic";

/** team.eyeknow.app — the affiliates' PWA home. Same accounts,
 *  same dashboard, same data as /affiliates on the main site; this
 *  surface is the affiliates' alone: track sales, print the flier,
 *  manage the link, the price, and payouts. Referral links and
 *  fliers always point at the consumer site (eyeknow.app), never
 *  at this host — the dashboard's team mode takes care of that. */
export default async function TeamPage() {
  let authed = false;
  if (dbConfigured()) {
    try {
      authed = (await getSessionUserByToken(cookies().get(SESSION_COOKIE)?.value)) !== null;
    } catch {
      authed = false;
    }
  }
  if (authed) return <AffiliatesDashboard teamMode />;
  return (
    <div className="app">
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 80px" }}>
        <p>
          <a href="https://eyeknow.app">← eyeKnow main site</a>
        </p>
        <h1 style={{ marginTop: 0 }}>eyeKnow Team</h1>
        <p>
          The affiliate home for eyeKnow. Sign in to track your sales, print your flier, and
          manage your link, price, and payouts.
        </p>
        <AffiliateSignIn returnTo="/" hideGoogleNote />
        <p className="muted" style={{ marginTop: 16 }}>
          Tip: add this page to your home screen to install the Team app on your phone.
        </p>
        <p className="muted" style={{ marginTop: 28 }}>
          eyeKnow — traditional iridology readings for interest and self-reflection. Not medical
          advice.
        </p>
      </main>
    </div>
  );
}
