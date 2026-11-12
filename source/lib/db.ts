// Postgres access for eyeKnow accounts + cloud readings.
// Tables are iris_-prefixed so the database can be shared safely.
// Everything degrades gracefully: when DATABASE_URL is not set the
// account features report "not configured" and the app keeps its
// device-local behavior.

import { createHash } from "crypto";
import { Pool } from "pg";

/** Access tokens (the printed report's QR link) are stored only as
 *  SHA-256 hashes, like session tokens. */
export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

declare global {
  // eslint-disable-next-line no-var
  var __irisPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __irisSchemaReady: Promise<void> | undefined;
}

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (!globalThis.__irisPool) {
    globalThis.__irisPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return globalThis.__irisPool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params as never[]);
  return res.rows as T[];
}

export function ensureSchema(): Promise<void> {
  if (!globalThis.__irisSchemaReady) {
    globalThis.__irisSchemaReady = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS iris_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        google_sub TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`ALTER TABLE iris_users ALTER COLUMN password_hash DROP NOT NULL`);
      await query(`ALTER TABLE iris_users ADD COLUMN IF NOT EXISTS google_sub TEXT`);
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS iris_users_google_sub_idx ON iris_users (google_sub) WHERE google_sub IS NOT NULL`,
      );
      await query(`CREATE TABLE IF NOT EXISTS iris_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES iris_users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS iris_scans (
        user_id UUID NOT NULL REFERENCES iris_users(id) ON DELETE CASCADE,
        scan_id TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        data JSONB NOT NULL,
        unlocked BOOLEAN NOT NULL DEFAULT false,
        unlocked_at TIMESTAMPTZ,
        PRIMARY KEY (user_id, scan_id)
      )`);
      await query(`ALTER TABLE iris_scans ADD COLUMN IF NOT EXISTS unlocked BOOLEAN NOT NULL DEFAULT false`);
      await query(`ALTER TABLE iris_scans ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ`);
      await query(`ALTER TABLE iris_scans ADD COLUMN IF NOT EXISTS basic BOOLEAN NOT NULL DEFAULT false`);
      await query(`CREATE TABLE IF NOT EXISTS iris_purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES iris_users(id) ON DELETE CASCADE,
        scan_id TEXT NOT NULL,
        stripe_session_id TEXT NOT NULL UNIQUE,
        amount_cents INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`ALTER TABLE iris_purchases ALTER COLUMN user_id DROP NOT NULL`);
      // Shared readings: a copy of every reading keyed by an access
      // token (the printed report's QR link). Whoever holds the link
      // can view and unlock the reading without an account; the
      // unlock can later be claimed into an account.
      await query(`CREATE TABLE IF NOT EXISTS iris_shared_scans (
        scan_id TEXT PRIMARY KEY,
        access_token_hash TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        data JSONB NOT NULL,
        unlocked BOOLEAN NOT NULL DEFAULT false,
        unlocked_at TIMESTAMPTZ
      )`);
      await query(`ALTER TABLE iris_shared_scans ADD COLUMN IF NOT EXISTS basic BOOLEAN NOT NULL DEFAULT false`);
      // Gift readings: a paid gift (token = the credential) that the
      // recipient redeems against one reading, unlocking it free.
      await query(`CREATE TABLE IF NOT EXISTS iris_gifts (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT,
        from_name TEXT,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'pending_payment',
        stripe_session_id TEXT UNIQUE,
        scan_id TEXT,
        email_sent BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        paid_at TIMESTAMPTZ,
        redeemed_at TIMESTAMPTZ
      )`);
      // Early-supporter free readings: when a $5.99 reading purchase
      // completes, the buyer gets 10 single-use share links (one per
      // row) to send friends and family. The token in each link is
      // derived deterministically from the grant id (see
      // lib/supporterGifts.ts), so the buyer's account area can
      // rebuild their links any time without storing tokens in plain
      // text; only the hash is stored. stripe_session_id is the
      // idempotency key: one purchase grants exactly 10, ever.
      await query(`CREATE TABLE IF NOT EXISTS iris_supporter_gifts (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL,
        owner_user_id UUID REFERENCES iris_users(id) ON DELETE CASCADE,
        scan_id TEXT NOT NULL,
        stripe_session_id TEXT NOT NULL,
        grant_slot INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'granted',
        redeemed_scan_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        redeemed_at TIMESTAMPTZ
      )`);
      await query(`CREATE UNIQUE INDEX IF NOT EXISTS iris_supporter_gifts_session_slot_idx ON iris_supporter_gifts (stripe_session_id, grant_slot)`);
      await query(`CREATE INDEX IF NOT EXISTS iris_supporter_gifts_owner_idx ON iris_supporter_gifts (owner_user_id) WHERE owner_user_id IS NOT NULL`);
      // Gift-redeemed unlock discounts: one row per reading that a
      // supporter link was redeemed against. The row is the server's
      // record that this reading unlocks at 10% off — checkout and
      // the webhook read it; the client never supplies it.
      await query(`CREATE TABLE IF NOT EXISTS iris_scan_discounts (
        scan_id TEXT PRIMARY KEY,
        discount_pct INTEGER NOT NULL,
        gift_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      // Book store downloads: one row per paid $9.99 book session
      // (webhook-only fulfillment, idempotent on stripe_session_id).
      await query(`CREATE TABLE IF NOT EXISTS iris_book_downloads (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL,
        user_id UUID REFERENCES iris_users(id) ON DELETE CASCADE,
        book_slug TEXT NOT NULL,
        stripe_session_id TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      // Affiliate program: affiliates set their own reading price
      // ($5.99–$19.99) and each attributed sale splits 50/50.
      // Balances are computed (shares minus paid minus pending),
      // never stored, so they cannot drift. Clicks carry no PII.
      await query(`CREATE TABLE IF NOT EXISTS iris_affiliates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES iris_users(id) ON DELETE CASCADE,
        code TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS iris_affiliate_clicks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`CREATE INDEX IF NOT EXISTS iris_affiliate_clicks_code_idx ON iris_affiliate_clicks (code)`);
      await query(`CREATE TABLE IF NOT EXISTS iris_affiliate_sales (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stripe_session_id TEXT NOT NULL UNIQUE,
        affiliate_user_id UUID NOT NULL REFERENCES iris_users(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS iris_affiliate_payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        affiliate_user_id UUID NOT NULL REFERENCES iris_users(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        paid_at TIMESTAMPTZ
      )`);
      await query(`CREATE UNIQUE INDEX IF NOT EXISTS iris_affiliate_payouts_one_pending_idx ON iris_affiliate_payouts (affiliate_user_id) WHERE status = 'pending'`);
      // Issuing payout support: one reusable cardholder per affiliate
      // (id only — never card numbers), one card id per paid payout,
      // and a pending reason when Issuing can't fulfill yet.
      await query(`ALTER TABLE iris_affiliates ADD COLUMN IF NOT EXISTS stripe_cardholder_id TEXT`);
      await query(`ALTER TABLE iris_affiliate_payouts ADD COLUMN IF NOT EXISTS status_detail TEXT`);
      await query(`ALTER TABLE iris_affiliate_payouts ADD COLUMN IF NOT EXISTS stripe_card_id TEXT`);
      // Affiliate-set pricing (v2): price per affiliate, custom link
      // slug (unique; NULLs unlimited), and the charged amount on
      // each sale row (amount_cents stays the affiliate's share, so
      // balance math is unchanged). Old sale rows were $5.99 sales.
      await query(`ALTER TABLE iris_affiliates ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 1999`);
      // Default affiliate price is $19.99 (Adam, 2026-11-01; was
      // $5.99 at program launch). SET DEFAULT only affects rows
      // created later — existing affiliates keep their stored price.
      await query(`ALTER TABLE iris_affiliates ALTER COLUMN price_cents SET DEFAULT 1999`);
      await query(`ALTER TABLE iris_affiliates ADD COLUMN IF NOT EXISTS custom_slug TEXT`);
      await query(`CREATE UNIQUE INDEX IF NOT EXISTS iris_affiliates_custom_slug_idx ON iris_affiliates (custom_slug)`);
      await query(`ALTER TABLE iris_affiliate_sales ADD COLUMN IF NOT EXISTS charged_cents INTEGER`);
      await query(`UPDATE iris_affiliate_sales SET charged_cents = 599 WHERE charged_cents IS NULL`);
      await query(`ALTER TABLE iris_affiliate_sales ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'reading'`);
      await query(`ALTER TABLE iris_affiliate_sales ADD COLUMN IF NOT EXISTS title TEXT`);
      // Timeline subscriptions: one-time payment per term (never a
      // Stripe recurring subscription). A subscription buys weekly
      // included scans (48 per iris per subscription-year, full
      // report unlocked) plus a monthly human-written overview.
      // Allowance and overview rows are keyed to the subscription;
      // balances stay computed from iris_affiliate_sales (kind =
      // 'subscription'), so subscription flats join the same
      // virtual-card payout pool as reading shares and book shares.
      await query(`CREATE TABLE IF NOT EXISTS iris_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES iris_users(id) ON DELETE CASCADE,
        guest_email TEXT,
        term TEXT NOT NULL,
        price_cents INTEGER NOT NULL,
        starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ends_at TIMESTAMPTZ,
        stripe_session_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`CREATE INDEX IF NOT EXISTS iris_subscriptions_user_idx ON iris_subscriptions (user_id) WHERE user_id IS NOT NULL`);
      await query(`CREATE TABLE IF NOT EXISTS iris_subscription_scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscription_id UUID NOT NULL REFERENCES iris_subscriptions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES iris_users(id) ON DELETE CASCADE,
        scan_id TEXT NOT NULL,
        iris TEXT NOT NULL,
        scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (subscription_id, scan_id)
      )`);
      await query(`CREATE INDEX IF NOT EXISTS iris_subscription_scans_sub_iris_idx ON iris_subscription_scans (subscription_id, iris, scanned_at)`);
      await query(`CREATE TABLE IF NOT EXISTS iris_subscription_overviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscription_id UUID NOT NULL REFERENCES iris_subscriptions(id) ON DELETE CASCADE,
        month_start DATE NOT NULL,
        overview_text TEXT,
        written_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (subscription_id, month_start)
      )`);
      await query(`CREATE TABLE IF NOT EXISTS iris_support_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES iris_users(id) ON DELETE SET NULL,
        email TEXT NOT NULL,
        topic TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      // Affiliate setup (2026-11-01): joining runs through a setup
      // flow that records terms agreement. Rows created before the
      // flow existed keep NULLs (grandfathered, never gated).
      await query(`ALTER TABLE iris_affiliates ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ`);
      await query(`ALTER TABLE iris_affiliates ADD COLUMN IF NOT EXISTS terms_version TEXT`);
      // Unlock-reminder push (Adam, 2026-11-05): a device's push
      // subscription, and one reminder row per (device, scan) armed
      // when someone with notifications on leaves a reading locked.
      // stage 0 = first nudge due, 1 = second sent, 2 = done.
      await query(`CREATE TABLE IF NOT EXISTS iris_push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_id UUID REFERENCES iris_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS iris_unlock_reminders (
        endpoint TEXT NOT NULL,
        scan_id TEXT NOT NULL,
        stage INTEGER NOT NULL DEFAULT 0,
        last_sent_at BIGINT,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (endpoint, scan_id)
      )`);
      // Homepage reviews (Adam, 2026-11-05): visitors submit from
      // the reviews section; nothing shows publicly until the
      // owner approves it in /admin (status pending → approved).
      await query(`CREATE TABLE IF NOT EXISTS iris_reviews (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        context TEXT,
        stars INTEGER NOT NULL DEFAULT 5,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        user_id UUID REFERENCES iris_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    })().catch((err) => {
      globalThis.__irisSchemaReady = undefined;
      throw err;
    });
  }
  return globalThis.__irisSchemaReady;
}
