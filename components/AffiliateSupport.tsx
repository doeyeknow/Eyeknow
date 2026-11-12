"use client";

import { useState } from "react";

/** Support tab for the team app (also usable anywhere a signed-in
 *  affiliate needs help): the questions affiliates actually ask,
 *  answered from the program's real rules, plus a contact form
 *  backed by POST /api/support. Replies go to the account email. */

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How does my link work?",
    a: "Anyone who opens your link lands on eyeKnow with you as their referrer for 30 days. Anything they buy in that window is credited to you. Both forms of your link work: your name link (eyeknow.app/yourname) and your original code link.",
  },
  {
    q: "What do I earn?",
    a: "Half of every reading sale at your price — a $5.99 reading pays you $3.00. Book sales pay $3.00 each. Timeline subscriptions pay $50 flat for the 1-year term and $100 flat for longer terms and lifetime. Everything lands in one balance in your Wallet.",
  },
  {
    q: "When and how do I get paid?",
    a: "Whenever you have a balance, tap Request payout in the Wallet tab. Payouts are issued as a virtual debit card loaded with your full available balance, and once a card is paid you can view it from your payout history. If a payout is waiting on something, its status in the Wallet says what's needed.",
  },
  {
    q: "Can I change my link name?",
    a: "No — link names are permanent once set, on purpose: links you've shared and fliers you've printed keep working forever. Your original code link also keeps working. If you set a name with a serious mistake in it, send us a message below and we'll take a look.",
  },
  {
    q: "Can I change my price?",
    a: "Yes, any time, from the Stats tab. The new price applies to future sales only — a checkout that already started keeps the price it started with. Books are always $9.99 and always pay you $3.00, whatever your reading price is.",
  },
  {
    q: "What doesn't earn?",
    a: "Your own purchases, $1 Timeline follow-up scans, and free gift readings don't earn. Paid gift readings bought through your link do earn, like any other reading.",
  },
  {
    q: "Someone bought through my link but no sale shows. Why?",
    a: "Sales are credited when the payment completes, and only when the purchase happens within 30 days of the visit, in the same browser where your link was opened. If a sale you expected still hasn't appeared after a day, message us below with the approximate time and what was bought, and we'll check it.",
  },
];

const TOPICS = [
  "Payouts",
  "My link",
  "A sale didn't credit",
  "Sharing & fliers",
  "Something else",
];

export default function AffiliateSupport() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — try again.");
        return;
      }
      setSent(true);
      setMessage("");
    } catch {
      setError("Couldn't reach the support service — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Common questions</h3>
      {FAQS.map((f) => (
        <details key={f.q} style={{ marginBottom: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{f.q}</summary>
          <p className="muted" style={{ margin: "6px 0 10px" }}>{f.a}</p>
        </details>
      ))}
      <h3 style={{ marginTop: 22 }}>Message us</h3>
      {sent ? (
        <p>
          Message sent — we&apos;ll reply to your account email.{" "}
          <button
            type="button"
            className="btn"
            onClick={() => setSent(false)}
            style={{ marginLeft: 6 }}
          >
            Send another
          </button>
        </p>
      ) : (
        <form className="auth-form" onSubmit={(e) => void submit(e)}>
          <label>
            Topic
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px" }}
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Your message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={3000}
              required
              placeholder="Tell us what's going on…"
              style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px" }}
            />
          </label>
          {error && <p className="warn">{error}</p>}
          <button type="submit" className="btn big" disabled={busy || message.trim().length < 5}>
            {busy ? "Sending…" : "Send message"}
          </button>
        </form>
      )}
      <p className="muted" style={{ marginBottom: 0 }}>
        Messages go to the eyeKnow team, and replies come back to your account email.
      </p>
    </div>
  );
}
