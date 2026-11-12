"use client";

import { useEffect, useState } from "react";
import type { AffiliateStats } from "@/lib/affiliates";
import AffiliateFlier from "@/components/AffiliateFlier";
import ShareToolbox from "@/components/ShareToolbox";
import AffiliateSupport from "@/components/AffiliateSupport";
import SellingGuide from "@/components/SellingGuide";
import AffiliateSetup from "@/components/AffiliateSetup";

/** Affiliate dashboard: join, link, clicks, sales, computed balance,
 *  and payout requests. Rendered only behind the server-side login
 *  gate in app/affiliates/page.tsx; the needsAuth branch below only
 *  fires if the session expires mid-use.
 *
 *  teamMode renders the same dashboard as the team.eyeknow.app PWA
 *  home. The one behavioral difference that matters: referral links
 *  (and therefore the flier's QR and printed link) are always built
 *  on the consumer site, https://eyeknow.app — never on the team
 *  host, where a /<name> path is not a referral landing. */
export default function AffiliatesDashboard({ teamMode = false }: { teamMode?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cardBusy, setCardBusy] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<number>(1999);
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceNote, setPriceNote] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<string, {
    last4?: string;
    number?: string | null;
    cvc?: string | null;
    exp_month?: number;
    exp_year?: number;
    status?: string;
  }>>({});
  const [teamTab, setTeamTab] = useState<"stats" | "share" | "print" | "wallet" | "support">("stats");

  /** The public base for referral links: the consumer site. On the
   *  main site that's the visitor's own origin; on the team PWA it
   *  is always the canonical eyeknow.app. */
  function publicBase(): string {
    return teamMode ? "https://eyeknow.app" : window.location.origin;
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliates");
      if (res.status === 401) {
        setNeedsAuth(true);
        setStats(null);
        return;
      }
      const d = (await res.json().catch(() => null)) as { affiliate?: AffiliateStats | null } | null;
      setStats(d?.affiliate ?? null);
      if (d?.affiliate) {
        // Primary share link: the clean path form. The ?ref= form
        // keeps working for both the code and the custom slug.
        const handle = d.affiliate.customSlug ?? d.affiliate.code;
        setLink(`${publicBase()}/${handle}`);
        setPriceInput(d.affiliate.priceCents);
      }
    } catch {
      setError("Couldn't load affiliate stats — try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestPayout() {
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const res = await fetch("/api/affiliates/payout", { method: "POST" });
      const d = (await res.json().catch(() => null)) as {
        error?: string;
        fulfillment?: string;
        detail?: string | null;
      } | null;
      if (!res.ok) {
        setError(d?.error ?? "Couldn't request payout — try again in a moment.");
        return;
      }
      if (d?.fulfillment === "paid") {
        setNote("Your virtual card is ready — find it under Payout requests below.");
      } else if (d?.detail === "needs_identity") {
        setNote(
          "To issue your card we need your legal name and billing address — that step isn't built yet, so your request stays pending and your balance is untouched.",
        );
      } else if (d?.detail === "issuing_unavailable") {
        setNote(
          "Card issuing isn't active on our Stripe account yet, so your request is saved as pending and your balance is untouched. It will be fulfilled once issuing is active — you can retry from here.",
        );
      } else {
        setNote("Payout requested — it will show as pending until it is paid.");
      }
      await load();
    } catch {
      setError("Couldn't request payout — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function retryPayout() {
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const res = await fetch("/api/affiliates/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      const d = (await res.json().catch(() => null)) as {
        error?: string;
        fulfillment?: string;
        detail?: string | null;
      } | null;
      if (!res.ok) {
        setError(d?.error ?? "Couldn't retry — try again in a moment.");
        return;
      }
      if (d?.fulfillment === "paid") {
        setNote("Your virtual card is ready — find it under Payout requests below.");
      } else {
        setNote("Card issuing still isn't available — your request stays pending and your balance is untouched.");
      }
      await load();
    } catch {
      setError("Couldn't retry — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function showCard(payoutId: string) {
    if (cards[payoutId]) {
      setCards((prev) => {
        const next = { ...prev };
        delete next[payoutId];
        return next;
      });
      return;
    }
    setCardBusy(payoutId);
    setCardError(null);
    try {
      const res = await fetch(`/api/affiliates/card?payoutId=${encodeURIComponent(payoutId)}`);
      const d = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setCardError("Couldn't load card details — try again in a moment.");
        return;
      }
      setCards((prev) => ({ ...prev, [payoutId]: d as never }));
    } catch {
      setCardError("Couldn't load card details — try again in a moment.");
    } finally {
      setCardBusy(null);
    }
  }

  async function savePrice() {
    setPriceSaving(true);
    setPriceNote(null);
    setError(null);
    try {
      const res = await fetch("/api/affiliates/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents: priceInput }),
      });
      const d = (await res.json().catch(() => null)) as { error?: string; priceCents?: number } | null;
      if (!res.ok) {
        setError(d?.error ?? "Couldn't save price — try again in a moment.");
        return;
      }
      setPriceNote(`Price saved — future reading sales through your link charge $${((d?.priceCents ?? priceInput) / 100).toFixed(2)} and split 50/50 with you.`);
      await load();
    } catch {
      setError("Couldn't save price — try again in a moment.");
    } finally {
      setPriceSaving(false);
    }
  }

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // Team PWA sections: on the main site every panel shows in one
  // scroll; in teamMode the bottom bar switches between them.
  const showStats = !teamMode || teamTab === "stats";
  const showShare = !teamMode || teamTab === "share";
  const showPrint = !teamMode || teamTab === "print";
  const showWallet = !teamMode || teamTab === "wallet";
  const showSupport = teamMode && teamTab === "support";

  return (
    <div className="app">
      <main style={{ maxWidth: 760, margin: "0 auto", padding: teamMode ? "28px 18px 118px" : "28px 18px 80px" }}>
        <p>
          {teamMode ? (
            <a href="https://eyeknow.app">← eyeKnow main site</a>
          ) : (
            <a href="/">← Back to eyeKnow</a>
          )}
        </p>
        <h1 style={{ marginTop: 0 }}>{teamMode ? "eyeKnow Team" : "Affiliates"}</h1>
        <p className="muted">
          Share eyeKnow with your own link and earn on every sale through it. You set your
          reading price ($5.99–$19.99), and each reading sale splits <b>50/50</b> between you
          and eyeKnow. Each book sale through your link earns you <b>$3.00 flat</b> (books
          stay $9.99). Each Timeline subscription sale through your link earns you <b>$50
          flat</b> on a 1-year term or <b>$100 flat</b> on longer terms and lifetime.
          Earnings count only on paid sales — free gift readings and $1
          follow-ups don&apos;t earn, and you can&apos;t earn on your own purchases.
        </p>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="warn">{error}</p>}
        {note && <p>{note}</p>}
        {!loading && needsAuth && (
          <section className="panel">
            <h2 style={{ marginTop: 0 }}>Your session expired</h2>
            <p>
              Sign in again to keep using your affiliate dashboard.
            </p>
            <a className="btn big" href={teamMode ? "/" : "/affiliates"}>
              Sign in
            </a>
          </section>
        )}
        {!loading && !needsAuth && !stats && (
          <section className="panel">
            <h2 style={{ marginTop: 0 }}>Become an affiliate</h2>
            <p>
              A short setup gets you earning: agree to the terms, choose your permanent
              link name, set your reading price, and read a quick guide to selling
              readings. Every paid reading bought through your link splits 50/50 with you,
              and every book sale earns you $3.00.
            </p>
            <button type="button" className="btn big" onClick={() => setSetupOpen(true)}>
              Start affiliate setup
            </button>
          </section>
        )}
        {!loading && stats && (
          <>
            {showStats && (
            <section className="panel">
              <h2 style={{ marginTop: 0 }}>Your reading price</h2>
              <p className="muted" style={{ marginTop: -6 }}>
                Visitors who come through your link pay this price for a full reading, and each
                sale splits 50/50 with you. Changing it affects future sales only — checkouts
                already started keep the price they started with. Books always stay $9.99 and
                always earn you $3.00, whatever this slider says.
              </p>
              <p>
                <b>{money(priceInput)}</b> per reading — your share{" "}
                <b>{money(Math.floor((priceInput + 1) / 2))}</b>
              </p>
              <input
                type="range"
                min={599}
                max={1999}
                step={1}
                value={priceInput}
                onChange={(e) => setPriceInput(Number(e.target.value))}
                style={{ width: "100%" }}
                aria-label="Reading price"
              />
              <div style={{ display: "flex", justifyContent: "space-between" }} className="muted">
                <span>$5.99</span>
                <span>$19.99</span>
              </div>
              {priceNote && <p>{priceNote}</p>}
              <button
                type="button"
                className="btn"
                disabled={priceSaving || priceInput === stats.priceCents}
                onClick={() => void savePrice()}
                style={{ marginTop: 8 }}
              >
                {priceSaving ? "Saving…" : "Save price"}
              </button>
            </section>
            )}
            {showWallet && (
            <section className="panel">
              <h2 style={{ marginTop: 0 }}>Earnings</h2>
              <p>
                Clicks: <b>{stats.clicks}</b> · Sales: <b>{stats.sales.length}</b> · Earned:{" "}
                <b>{money(stats.earnedCents)}</b> · Requested: <b>{money(stats.pendingCents)}</b> ·{" "}
                Paid: <b>{money(stats.paidCents)}</b>
              </p>
              <p>
                Available balance: <b>{money(stats.availableCents)}</b>
              </p>
              <p className="muted" style={{ marginTop: -6 }}>
                Balance counts reading shares and book shares together, minus requested and
                paid amounts.
              </p>
              <button
                type="button"
                className="btn big"
                disabled={busy || stats.availableCents <= 0 || stats.pendingCents > 0}
                onClick={() => void requestPayout()}
              >
                {stats.pendingCents > 0
                  ? "Payout already requested"
                  : busy
                    ? "Requesting…"
                    : "Request payout"}
              </button>
              <p className="muted" style={{ marginBottom: 0 }}>
                Payouts arrive as a virtual debit card, capped at the payout amount. If card
                issuing isn&apos;t active yet, your request stays pending and your balance is
                safe until it can be fulfilled.
              </p>
            </section>
            )}
            {showStats && stats.sales.length > 0 && (
              <section className="panel">
                <h2 style={{ marginTop: 0 }}>Sales</h2>
                <ul>
                  {stats.sales.map((s) => (
                    <li key={s.id}>
                      {new Date(s.created_at).toLocaleDateString()} —{" "}
                      {s.kind === "book" ? (
                        <>Book: {s.title ?? "Book"} — buyer paid {money(s.charged_cents)} · your share {money(s.amount_cents)}</>
                      ) : s.kind === "subscription" ? (
                        <>{s.title ?? "Timeline subscription"} — buyer paid {money(s.charged_cents)} · your share {money(s.amount_cents)}</>
                      ) : (
                        <>Reading — buyer paid {money(s.charged_cents)} · your share {money(s.amount_cents)}</>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {showWallet && stats.payouts.length > 0 && (
              <section className="panel">
                <h2 style={{ marginTop: 0 }}>Payout requests</h2>
                {cardError && <p className="warn">{cardError}</p>}
                <ul>
                  {stats.payouts.map((p) => (
                    <li key={p.id}>
                      {new Date(p.requested_at).toLocaleDateString()} — {money(p.amount_cents)} —{" "}
                      {p.status}
                      {p.status === "pending" && p.status_detail && (
                        <span>
                          {" "}
                          {p.status_detail === "needs_identity"
                            ? "— to issue your card we need your legal name and billing address, which isn't collected yet, so this stays pending and your balance is untouched."
                            : "— card issuing isn't active yet, so this stays pending and your balance is untouched."}{" "}
                          <button
                            type="button"
                            className="btn"
                            disabled={busy}
                            onClick={() => void retryPayout()}
                          >
                            Retry card issue
                          </button>
                        </span>
                      )}
                      {p.status === "paid" && p.has_card && (
                        <span>
                          {" "}
                          <button
                            type="button"
                            className="btn"
                            disabled={cardBusy === p.id}
                            onClick={() => void showCard(p.id)}
                          >
                            {cards[p.id] ? "Hide card" : cardBusy === p.id ? "Loading…" : "Show card"}
                          </button>
                          {cards[p.id] && (
                            <span style={{ display: "block", marginTop: 6 }}>
                              Card ···· {cards[p.id].last4 ?? "????"} · Exp{" "}
                              {cards[p.id].exp_month}/{cards[p.id].exp_year}
                              {cards[p.id].number && (
                                <>
                                  <br />
                                  Number: {cards[p.id].number} · CVC: {cards[p.id].cvc}
                                </>
                              )}
                            </span>
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {link && showPrint && (
              <section className="panel">
                <h2 style={{ marginTop: 0 }}>Your printable fliers</h2>
                <p className="muted" style={{ marginTop: -6 }}>
                  Ready-made advertisements with your link embedded as a QR code. Anyone who
                  scans one lands on eyeKnow through your referral, at your price.
                </p>
                <AffiliateFlier
                  link={link}
                  handle={stats.customSlug ?? stats.code}
                />
              </section>
            )}

            {link && showShare && (
              <section className="panel">
                <h2 style={{ marginTop: 0 }}>Share toolbox</h2>
                <p className="muted" style={{ marginTop: -6 }}>
                  Pick a post, tweak the wording if you like, and share it. Your link rides
                  along on every button, so anything bought through the post is credited to
                  you. Your link is{" "}
                  <b style={{ wordBreak: "break-all" }}>{link}</b> — it is attached to every
                  share and printed on every flier.
                </p>
                <ShareToolbox link={link} code={stats.code} priceCents={stats.priceCents} />
              </section>
            )}
            {link && showShare && (
              <section className="panel">
                <h2 style={{ marginTop: 0 }}>How to sell readings</h2>
                <SellingGuide />
              </section>
            )}
            {showSupport && (
              <section className="panel">
                <h2 style={{ marginTop: 0 }}>Support</h2>
                <AffiliateSupport />
                <h2 style={{ marginTop: 26 }}>How to sell readings</h2>
                <SellingGuide />
              </section>
            )}
          </>
        )}
        <p className="muted" style={{ marginTop: 28 }}>
          eyeKnow — traditional iridology readings for interest and self-reflection. Not medical
          advice.
        </p>
      </main>
      {setupOpen && (
        <AffiliateSetup
          onClose={() => setSetupOpen(false)}
          onDone={() => {
            setSetupOpen(false);
            void load();
          }}
        />
      )}
      {teamMode && !loading && stats && (
        <nav className="bottombar" aria-label="Team sections">
          {(
            [
              {
                id: "stats",
                label: "Stats",
                icon: (
                  <>
                    <path d="M4 20h16" />
                    <path d="M6.5 20v-6" />
                    <path d="M11.5 20V6" />
                    <path d="M16.5 20v-9" />
                  </>
                ),
              },
              {
                id: "share",
                label: "Sharing",
                icon: (
                  <>
                    <circle cx="6" cy="12" r="2.6" />
                    <circle cx="17.5" cy="5.5" r="2.6" />
                    <circle cx="17.5" cy="18.5" r="2.6" />
                    <path d="M8.3 10.8l6.9-4.1" />
                    <path d="M8.3 13.2l6.9 4.1" />
                  </>
                ),
              },
              {
                id: "print",
                label: "Print",
                icon: (
                  <>
                    <path d="M6 9V3h12v6" />
                    <rect x="3" y="9" width="18" height="8" rx="2" />
                    <path d="M6 14h12v7H6z" />
                  </>
                ),
              },
              {
                id: "wallet",
                label: "Wallet",
                icon: (
                  <>
                    <rect x="3" y="6" width="18" height="13" rx="2.5" />
                    <path d="M3 10.5h18" />
                  </>
                ),
              },
              {
                id: "support",
                label: "Support",
                icon: (
                  <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" />
                ),
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`bar-btn${teamTab === t.id ? " active" : ""}`}
              aria-pressed={teamTab === t.id}
              onClick={() => setTeamTab(t.id)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {t.icon}
              </svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
