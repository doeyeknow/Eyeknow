import { ensureSchema, query } from "@/lib/db";
import type { AccountUser } from "@/lib/auth";

/**
 * Site-owner admin for the /admin dashboard (Adam, 2026-11-03).
 * Only these sign-in emails can see cross-account affiliate and
 * sales data. The API route re-checks this on every request —
 * the page-level check is only presentation.
 */
const ADMIN_EMAILS = ["taoswoodz@gmail.com", "bridgethegap801@gmail.com"];

export function isAdminUser(user: AccountUser | null): boolean {
  return !!user && ADMIN_EMAILS.includes(user.email.trim().toLowerCase());
}

export interface AdminAffiliateRow {
  email: string;
  code: string;
  custom_slug: string | null;
  price_cents: number;
  created_at: string;
  terms_agreed_at: string | null;
  clicks: number;
  sales_count: number;
  gross_cents: number;
  earned_cents: number;
  paid_cents: number;
  pending_cents: number;
}

export interface AdminSaleRow {
  id: string;
  kind: string;
  title: string | null;
  amount_cents: number;
  charged_cents: number;
  created_at: string;
  affiliate_email: string;
  code: string;
  custom_slug: string | null;
}

export interface AdminPayoutRow {
  id: string;
  amount_cents: number;
  status: string;
  status_detail: string | null;
  requested_at: string;
  paid_at: string | null;
  affiliate_email: string;
}

export interface AdminOverview {
  affiliates: AdminAffiliateRow[];
  recentSales: AdminSaleRow[];
  payouts: AdminPayoutRow[];
  totals: {
    affiliateCount: number;
    salesCount: number;
    grossCents: number;
    earnedCents: number;
    paidCents: number;
    pendingCents: number;
    availableCents: number;
    clicks: number;
  };
}

/** Every affiliate with their numbers, plus the latest sales and
 *  payout requests across the program. Balances are computed from
 *  the sales/payout rows (the same math as getAffiliateStats), so
 *  they cannot drift. */
export async function getAdminOverview(): Promise<AdminOverview> {
  await ensureSchema();
  const affiliates = await query<AdminAffiliateRow>(
    `SELECT u.email, a.code, a.custom_slug,
       COALESCE(a.price_cents, 1999)::int AS price_cents,
       a.created_at, a.terms_agreed_at,
       (SELECT COUNT(*)::int FROM iris_affiliate_clicks c WHERE c.code = a.code) AS clicks,
       (SELECT COUNT(*)::int FROM iris_affiliate_sales s WHERE s.affiliate_user_id = u.id) AS sales_count,
       (SELECT COALESCE(SUM(charged_cents), 0)::int FROM iris_affiliate_sales s WHERE s.affiliate_user_id = u.id) AS gross_cents,
       (SELECT COALESCE(SUM(amount_cents), 0)::int FROM iris_affiliate_sales s WHERE s.affiliate_user_id = u.id) AS earned_cents,
       (SELECT COALESCE(SUM(amount_cents), 0)::int FROM iris_affiliate_payouts p WHERE p.affiliate_user_id = u.id AND p.status = 'paid') AS paid_cents,
       (SELECT COALESCE(SUM(amount_cents), 0)::int FROM iris_affiliate_payouts p WHERE p.affiliate_user_id = u.id AND p.status = 'pending') AS pending_cents
     FROM iris_affiliates a
     JOIN iris_users u ON u.id = a.user_id
     ORDER BY earned_cents DESC, a.created_at ASC`,
  );
  const recentSales = await query<AdminSaleRow>(
    `SELECT s.id, COALESCE(s.kind, 'reading') AS kind, s.title,
       s.amount_cents, COALESCE(s.charged_cents, 599) AS charged_cents,
       s.created_at, u.email AS affiliate_email, a.code, a.custom_slug
     FROM iris_affiliate_sales s
     JOIN iris_users u ON u.id = s.affiliate_user_id
     JOIN iris_affiliates a ON a.user_id = u.id
     ORDER BY s.created_at DESC LIMIT 50`,
  );
  const payouts = await query<AdminPayoutRow>(
    `SELECT p.id, p.amount_cents, p.status, p.status_detail,
       p.requested_at, p.paid_at, u.email AS affiliate_email
     FROM iris_affiliate_payouts p
     JOIN iris_users u ON u.id = p.affiliate_user_id
     ORDER BY (p.status = 'pending') DESC, p.requested_at DESC LIMIT 50`,
  );
  const sum = (f: (a: AdminAffiliateRow) => number) =>
    affiliates.reduce((t, a) => t + f(a), 0);
  const earned = sum((a) => a.earned_cents);
  const paid = sum((a) => a.paid_cents);
  const pending = sum((a) => a.pending_cents);
  return {
    affiliates,
    recentSales,
    payouts,
    totals: {
      affiliateCount: affiliates.length,
      salesCount: sum((a) => a.sales_count),
      grossCents: sum((a) => a.gross_cents),
      earnedCents: earned,
      paidCents: paid,
      pendingCents: pending,
      availableCents: Math.max(0, earned - paid - pending),
      clicks: sum((a) => a.clicks),
    },
  };
}
