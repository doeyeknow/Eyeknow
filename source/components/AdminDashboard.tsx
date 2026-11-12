"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminOverview } from "@/lib/admin";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const kindLabel = (kind: string, title: string | null) =>
  kind === "book" ? `Book — ${title ?? "—"}` : kind === "subscription" ? "Subscription" : "Reading";

/** Site-owner dashboard: every affiliate, their sales, and the
 *  payout queue. Data comes from /api/admin/overview, which
 *  re-checks the owner gate on every request. */
export default function AdminDashboard({ email }: { email: string }) {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/overview");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as AdminOverview);
    } catch {
      setError("Could not load the overview. Try Refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const t = data?.totals;

  return (
    <div className="app">
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 18px 80px", width: "100%" }}>
        <p>
          <a href="https://eyeknow.app">← eyeKnow main site</a>
        </p>
        <div className="admin-head">
          <h1 style={{ margin: 0 }}>Affiliates &amp; Sales</h1>
          <button type="button" className="btn ghost" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
        <p className="muted">
          Signed in as {email}. Showing affiliate-attributed sales — readings split 50/50,
          books $3.00 flat, subscriptions $50/$100 flat.
        </p>

        {error && <p className="admin-error">{error}</p>}
        {loading && !data && <p className="muted">Loading…</p>}

        {data && t && (
          <>
            <div className="admin-cards">
              <div className="admin-card">
                <span className="admin-card-num">{t.affiliateCount}</span>
                <span className="admin-card-label">Affiliates</span>
              </div>
              <div className="admin-card">
                <span className="admin-card-num">{t.salesCount}</span>
                <span className="admin-card-label">Sales</span>
              </div>
              <div className="admin-card">
                <span className="admin-card-num">{money(t.grossCents)}</span>
                <span className="admin-card-label">Gross sales</span>
              </div>
              <div className="admin-card">
                <span className="admin-card-num">{money(t.earnedCents)}</span>
                <span className="admin-card-label">Affiliate earnings</span>
              </div>
              <div className="admin-card">
                <span className="admin-card-num">{money(t.paidCents)}</span>
                <span className="admin-card-label">Paid out</span>
              </div>
              <div className="admin-card">
                <span className="admin-card-num">{money(t.pendingCents)}</span>
                <span className="admin-card-label">Payouts pending</span>
              </div>
              <div className="admin-card">
                <span className="admin-card-num">{money(t.availableCents)}</span>
                <span className="admin-card-label">Balances available</span>
              </div>
              <div className="admin-card">
                <span className="admin-card-num">{t.clicks}</span>
                <span className="admin-card-label">Link clicks</span>
              </div>
            </div>

            <h2 className="admin-h2">Affiliates</h2>
            {data.affiliates.length === 0 ? (
              <p className="muted">No affiliates yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Affiliate</th>
                      <th>Link</th>
                      <th>Price</th>
                      <th>Joined</th>
                      <th>Clicks</th>
                      <th>Sales</th>
                      <th>Gross</th>
                      <th>Earned</th>
                      <th>Paid</th>
                      <th>Pending</th>
                      <th>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.affiliates.map((a) => (
                      <tr key={a.code}>
                        <td>{a.email}</td>
                        <td>eyeknow.app/{a.custom_slug ?? a.code}</td>
                        <td>{money(a.price_cents)}</td>
                        <td>{day(a.created_at)}</td>
                        <td>{a.clicks}</td>
                        <td>{a.sales_count}</td>
                        <td>{money(a.gross_cents)}</td>
                        <td>{money(a.earned_cents)}</td>
                        <td>{money(a.paid_cents)}</td>
                        <td>{money(a.pending_cents)}</td>
                        <td>{money(Math.max(0, a.earned_cents - a.paid_cents - a.pending_cents))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="admin-h2">Recent sales</h2>
            {data.recentSales.length === 0 ? (
              <p className="muted">No affiliate sales yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Affiliate</th>
                      <th>Item</th>
                      <th>Charged</th>
                      <th>Their share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSales.map((s) => (
                      <tr key={s.id}>
                        <td>{day(s.created_at)}</td>
                        <td>{s.affiliate_email}</td>
                        <td>{kindLabel(s.kind, s.title)}</td>
                        <td>{money(s.charged_cents)}</td>
                        <td>{money(s.amount_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="admin-h2">Payout requests</h2>
            {data.payouts.length === 0 ? (
              <p className="muted">No payout requests yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Requested</th>
                      <th>Affiliate</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payouts.map((p) => (
                      <tr key={p.id}>
                        <td>{day(p.requested_at)}</td>
                        <td>{p.affiliate_email}</td>
                        <td>{money(p.amount_cents)}</td>
                        <td>{p.status === "paid" && p.paid_at ? `paid ${day(p.paid_at)}` : p.status}</td>
                        <td>{p.status_detail ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <ReviewModeration />
      </main>
    </div>
  );
}

interface AdminReviewRow {
  id: string;
  name: string;
  context: string;
  stars: number;
  text: string;
  status: string;
  created_at: string;
}

/** Review moderation (Adam, 2026-11-05): homepage review
 *  submissions land here as pending; approving puts a review on
 *  the homepage, rejecting keeps it off. Self-contained — talks
 *  to /api/admin/reviews, which re-checks the owner gate. */
function ReviewModeration() {
  const [rows, setRows] = useState<AdminReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reviews");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { reviews: AdminReviewRow[] };
      setRows(d.reviews);
    } catch {
      setError("Could not load reviews.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? prev);
    } catch {
      setError("Could not update that review.");
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = rows?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <>
      <h2 className="admin-h2">
        Reviews{rows ? ` — ${pendingCount} waiting` : ""}
      </h2>
      {error && <p className="admin-error">{error}</p>}
      {!rows ? (
        <p className="muted">Loading reviews…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No reviews submitted yet. They arrive from the “Share your thoughts” button in the homepage reviews section.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "12px 14px",
                background: r.status === "pending" ? "#fff8e6" : "var(--card)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span>
                  <b>{r.name}</b>
                  {r.context ? <span className="muted"> · {r.context}</span> : null}{" "}
                  <span style={{ color: "#d9a441" }}>{"★".repeat(r.stars)}</span>
                </span>
                <span className="muted">
                  {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {r.status}
                </span>
              </div>
              <p style={{ margin: "8px 0 10px" }}>{r.text}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {r.status !== "approved" && (
                  <button type="button" className="btn" disabled={busy === r.id} onClick={() => void setStatus(r.id, "approved")}>
                    ✓ Approve
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button type="button" className="btn ghost" disabled={busy === r.id} onClick={() => void setStatus(r.id, "rejected")}>
                    Reject
                  </button>
                )}
                {r.status !== "pending" && (
                  <button type="button" className="btn ghost" disabled={busy === r.id} onClick={() => void setStatus(r.id, "pending")}>
                    Back to pending
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
