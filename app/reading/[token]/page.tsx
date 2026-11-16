import { cookies } from "next/headers";
import { getSessionUserByToken, SESSION_COOKIE } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";
import { markRevealCompleted, OFFER_WINDOW_MS } from "@/lib/firstBasicOffer";
import { getOfferEmailRow, scanIdForOfferLinkToken } from "@/lib/offerEmail";
import { scanCreatedAt } from "@/lib/push";
import OfferLinkForm from "@/components/OfferLinkForm";
import ReadingRedirect from "@/components/ReadingRedirect";

export const dynamic = "force-dynamic";

/** The email link's landing page (Adam, 2026-11-15 23:47 + 23:51):
 *  a signed, unguessable token that expires with the scan's 7-day
 *  window. The path says "reading" — the same link carries both
 *  funnel stages, and the stage-1 email must not hint at an offer.
 *  Valid token + signed in as the link's own email → the reveal
 *  completes here (flag set) and the reading opens. Valid
 *  token + anyone else → the set-password / sign-in form. An
 *  invalid token renders an honest error page that leaks no scan
 *  data — no reading contents, no scan id, nothing to probe with.
 *  The push notification's link is unchanged (it opens the reading
 *  in-app); only the email link runs this flow. */
export default async function OfferLinkPage({ params }: { params: { token: string } }) {
  const shell = (children: React.ReactNode) => (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: "0 16px" }}>
      <div className="panel">{children}</div>
    </main>
  );

  if (!dbConfigured()) {
    return shell(
      <>
        <h1>This link isn&rsquo;t available right now</h1>
        <p>Try again in a little while — or open the app and sign in to find your reading.</p>
      </>,
    );
  }
  await ensureSchema();
  const scanId = await scanIdForOfferLinkToken(params.token);
  const emailRow = scanId ? await getOfferEmailRow(scanId) : null;
  const created = scanId ? await scanCreatedAt(scanId) : null;
  if (!scanId || !emailRow || created === null) {
    return shell(
      <>
        <h1>This link isn&rsquo;t valid</h1>
        <p>
          Reading links are private to the email they were sent to. If you still need your
          reading, open the app and sign in — your readings are saved in your account.
        </p>
      </>,
    );
  }
  const expired = Date.now() >= created + OFFER_WINDOW_MS;
  const sessionToken = cookies().get(SESSION_COOKIE)?.value;
  const user = await getSessionUserByToken(sessionToken);
  // Already signed in AS the link's own email: the email-link flow
  // completes here — set the reveal flag and open the reading. A
  // different signed-in account must NOT complete someone else's
  // reveal; that visitor gets the form for the link's email.
  if (user && user.email === emailRow.email) {
    await markRevealCompleted(scanId);
    const readingUrl = `/?scan=${encodeURIComponent(scanId)}`;
    return shell(
      <>
        <h1>Opening your reading…</h1>
        <p>
          <a href={readingUrl}>Continue to your reading →</a>
        </p>
        <ReadingRedirect scanId={scanId} />
      </>,
    );
  }
  const existing = await query<{ id: string }>(`SELECT id FROM iris_users WHERE email = $1`, [
    emailRow.email,
  ]);
  return shell(
    <OfferLinkForm
      token={params.token}
      email={emailRow.email}
      accountExists={existing.length > 0}
      expired={expired}
      signedInAs={user ? user.email : null}
    />,
  );
}
