"use client";

import { useEffect, useState } from "react";
import { formatCents } from "./AffiliatePrice";
import { getReferralCode } from "./ReferralCapture";
import { SUBSCRIPTION_TERMS, type SubscriptionTermKey } from "@/lib/subscriptionTerms";

interface OverviewSlot {
  month_start: string;
  overview_text: string | null;
  written_at: string | null;
}

interface SubscriptionStatusData {
  id: string;
  term: string;
  termLabel: string;
  priceCents: number;
  startsAt: string;
  endsAt: string | null;
  lifetime: boolean;
  yearStart: string;
  yearEnd: string;
  remaining: { left: number; right: number };
  used: { left: number; right: number };
  overviews: OverviewSlot[];
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtMonth(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", timeZone: "UTC" });
  } catch {
    return iso;
  }
}

const TERM_ORDER: SubscriptionTermKey[] = ["1y", "5y", "10y", "20y", "lifetime"];

/**
 * Timeline subscription offer + subscriber status. Shown from the
 * Timeline tab: non-subscribers see the offer (one-time payment per
 * term, never a recurring charge); subscribers see their term, the
 * scans remaining this year per iris, and their monthly overviews —
 * written ones in full, unwritten ones honestly marked pending.
 * Overview text is human-written only; this component never invents
 * it. Framing stays traditional throughout: a guide, never a
 * diagnosis, never medical or mental-health counseling.
 */
export default function SubscriptionOffer() {
  const [status, setStatus] = useState<SubscriptionStatusData | null | undefined>(undefined);
  const [term, setTerm] = useState<SubscriptionTermKey>("5y");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/subscriptions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus((d as { subscription?: SubscriptionStatusData | null } | null)?.subscription ?? null))
      .catch(() => setStatus(null));
  }, []);

  async function buy() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, ref: getReferralCode() }),
      });
      const d = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !d?.url) {
        setNote(d?.error ?? "Checkout could not start — try again in a moment.");
        setBusy(false);
        return;
      }
      window.location.href = d.url;
    } catch {
      setNote("Checkout could not start — try again in a moment.");
      setBusy(false);
    }
  }

  if (status === undefined) {
    return (
      <section className="panel" aria-label="Timeline subscription">
        <p className="muted">Loading subscription…</p>
      </section>
    );
  }

  if (status) {
    const currentMonth = status.overviews[0];
    return (
      <section className="panel" aria-label="Your Timeline subscription">
        <h2 style={{ marginTop: 0 }}>Your Timeline subscription — {status.termLabel}</h2>
        <p>
          {status.lifetime ? (
            <>Lifetime — it never expires, and your weekly allowance renews every year.</>
          ) : (
            <>Active until {status.endsAt ? fmtDate(status.endsAt) : "—"}.</>
          )}{" "}
          One-time payment of {formatCents(status.priceCents)}.
        </p>
        <ul>
          <li>
            <b>Included scans this year</b> (year runs {fmtDate(status.yearStart)} –{" "}
            {fmtDate(status.yearEnd)}): <b>{status.remaining.left} left</b> for the left iris,{" "}
            <b>{status.remaining.right} left</b> for the right iris — at most one per iris per
            week, each with the full report unlocked.
          </li>
          <li>
            <b>Monthly overviews</b> — written by a real person after each month, on the
            changes your Timeline has tracked.
          </li>
        </ul>
        {currentMonth && (
          <p className="muted">
            Next overview ({fmtMonth(currentMonth.month_start)}):{" "}
            {currentMonth.overview_text ? "written — see below." : "pending — it appears here once written."}
          </p>
        )}
        {status.overviews.length > 0 && (
          <>
            <h3>Professional overviews</h3>
            {status.overviews.map((o) =>
              o.overview_text ? (
                <div key={o.month_start}>
                  <h4 style={{ marginBottom: 4 }}>{fmtMonth(o.month_start)}</h4>
                  <p style={{ marginTop: 0 }}>{o.overview_text}</p>
                </div>
              ) : (
                <div key={o.month_start}>
                  <h4 style={{ marginBottom: 4 }}>{fmtMonth(o.month_start)}</h4>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Pending — your overview for this month is written by a real person and
                    appears here once it is done.
                  </p>
                </div>
              ),
            )}
          </>
        )}
        <p className="muted">
          A traditional reading, not a diagnosis — never a substitute for professional
          medical advice, and not medical or mental-health counseling.
        </p>
      </section>
    );
  }

  return (
    <section className="panel" aria-label="Timeline subscription offer">
      <h2 style={{ marginTop: 0 }}>Timeline subscription — a guide that knows</h2>
      <p>
        A non-judgmental guide that follows your eyes over time — like a counselor at a
        fraction of the cost, with no judgments, only what the traditional chart has to say
        about how the pattern is shifting.
      </p>
      <ul>
        <li>
          <b>A free reading of each iris every week</b> — up to 48 included scans per iris
          per year (96 total), each with the <b>full report unlocked</b>, no $19.99, no $1.
        </li>
        <li>
          <b>A fully comprehensive Timeline report</b> that keeps monitoring the changes
          taking place across all those scans.
        </li>
        <li>
          <b>A professional overview conducted by real people after each month</b> — a
          human-written look at what changed, delivered to your Timeline.
        </li>
      </ul>
      <p className="muted">
        One-time payment per term — never a recurring charge. Scans beyond the weekly
        allowance stay at their normal prices.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {TERM_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`btn${term === key ? "" : " ghost"}`}
            onClick={() => setTerm(key)}
            aria-pressed={term === key}
          >
            {SUBSCRIPTION_TERMS[key].label} — {formatCents(SUBSCRIPTION_TERMS[key].priceCents)}
          </button>
        ))}
      </div>
      <button type="button" className="btn big" onClick={buy} disabled={busy}>
        {busy ? "Opening checkout…" : `Subscribe — ${SUBSCRIPTION_TERMS[term].label} (${formatCents(SUBSCRIPTION_TERMS[term].priceCents)})`}
      </button>
      {note && (
        <p className="warn" role="alert">
          {note}
        </p>
      )}
      <p className="muted">
        A traditional reading, never a diagnosis. This is not medical advice and not
        medical or mental-health counseling — if you have a health concern, see a qualified
        medical professional.
      </p>
    </section>
  );
}
