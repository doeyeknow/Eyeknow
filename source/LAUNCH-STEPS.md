# eyeKnow — remaining launch switches (Adam-only dashboard steps)

Status as of Sun Oct 18, 2026 (evening): **accounts are LIVE and Stripe
payments are LIVE.** The Neon database is connected (`DATABASE_URL` set
on the irisread Vercel project), sign-up/sign-in was tested end to end,
readings sync to accounts, and unpaid reports show the 5-sign free
preview with the $5.99 unlock offer.

## DONE — Live $5.99 charges (Stripe) — completed Sun Oct 18, 2026

Adam added a restricted Stripe key (`rk_…`) as `STRIPE_SECRET_KEY` and
the webhook signing secret as `STRIPE_WEBHOOK_SECRET` on the irisread
Vercel project (Production), and created the Stripe webhook endpoint
`https://eyeknow.app/api/stripe/webhook` for the
`checkout.session.completed` event.

Verified after redeploy on 2026-10-18:
- The restricted key's permissions are sufficient — the guest (QR /
  shared-reading, no-account) checkout path created a real Stripe
  Checkout session.
- The session was a `cs_live_` session — the account is in **live
  mode**, taking real payments.
- The webhook endpoint is armed — it rejects unsigned calls with a
  signature error, as expected.

### One proof still outstanding: a real first purchase

Live mode will not accept test cards, and Muse will not charge a real
card on its own. The final end-to-end proof is Adam making one real
$5.99 purchase:

1. Open any locked reading at https://eyeknow.app
2. Tap **Unlock full reading — $5.99** and complete payment in Stripe
   Checkout.
3. Tell Muse it is done — Muse will verify server-side that the
   reading flipped to fully unlocked (all signs, complete body map,
   personalized diet recommendations).

If Stripe shows an error at payment, note what it says and tell Muse.

## 1. Google sign-in (~5 minutes, Google Cloud Console) — still pending

Status: not configured as of the last check on 2026-10-18; no evidence
in chat since that Adam has added the credentials. The "Continue with
Google" button appears automatically once these are set.

1. console.cloud.google.com → create a project (e.g. "eyeKnow").
2. APIs & Services → OAuth consent screen: External, app name "eyeKnow",
   your email as support/developer contact, then **Publish** the consent
   screen (basic email/profile scopes need no Google review).
3. Credentials → Create Credentials → OAuth client ID → Web application.
   Under **Authorized redirect URIs** add exactly:
   `https://eyeknow.app/api/auth/google/callback`
4. Copy the Client ID and Client Secret into Vercel → project **irisread**
   → Settings → Environment Variables (Production) as:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

Google sign-in links to an existing password account with the same
email, so readings and unlocks stay together.

_Domain update (2026-10-22): eyeknow.app is registered at Porkbun and
linked to this project by Adam. The app is served on both eyeknow.app
and irisread.vercel.app; QR / shared-reading links are built from the
visitor's origin with eyeknow.app preferred on vercel.app hosts, and
the Google OAuth redirect URI above uses eyeknow.app._
