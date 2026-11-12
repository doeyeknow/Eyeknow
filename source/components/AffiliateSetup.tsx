"use client";

import { useState } from "react";

/** The affiliate signup setup — a four-step modal shown when a
 *  signed-in user joins the program (Adam's design, 2026-11-01):
 *
 *    1. Agree to the affiliate terms (required; the agreement is
 *       recorded server-side with AFFILIATE_TERMS_VERSION —
 *       bump that constant in lib/affiliates.ts when this text
 *       changes).
 *    2. Set their link name (permanent; availability is checked
 *       live so a bad or taken name fails here, not at the end).
 *    3. Set their reading price (defaults to $19.99).
 *    4. A short guide to selling readings.
 *
 *  Nothing is saved until Finish: the final step posts everything
 *  to POST /api/affiliates, which applies it atomically-ish via
 *  completeAffiliateSignup. Closing the modal abandons the setup
 *  with nothing created. Link previews always show eyeknow.app —
 *  referral links live on the consumer host, never the team host. */

const STEP_NAMES = ["Terms", "Your link", "Your price", "Selling guide"];

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function AffiliateSetup({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState("");
  const [checking, setChecking] = useState(false);
  const [priceCents, setPriceCents] = useState(1999);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");

  async function checkSlugAndContinue() {
    setChecking(true);
    setSlugError("");
    try {
      const res = await fetch(
        `/api/affiliates/slug-check?slug=${encodeURIComponent(slug.trim().toLowerCase())}`,
      );
      const d = (await res.json().catch(() => null)) as
        | { available?: boolean; error?: string }
        | null;
      if (!res.ok) {
        setSlugError("Couldn't check that name — try again in a moment.");
        return;
      }
      if (!d?.available) {
        setSlugError(d?.error ?? "That name can't be used — pick another.");
        return;
      }
      setStep(2);
    } catch {
      setSlugError("Couldn't check that name — try again in a moment.");
    } finally {
      setChecking(false);
    }
  }

  async function finish() {
    setFinishing(true);
    setFinishError("");
    try {
      const res = await fetch("/api/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          termsAgreed: true,
          slug: slug.trim().toLowerCase(),
          priceCents,
        }),
      });
      const d = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        const msg = d?.error ?? "Couldn't finish setup — try again in a moment.";
        // Name problems go back to the link step, where they belong.
        if (/name|taken|permanent/i.test(msg)) {
          setSlugError(msg);
          setStep(1);
          return;
        }
        setFinishError(msg);
        return;
      }
      onDone();
    } catch {
      setFinishError("Couldn't finish setup — try again in a moment.");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Affiliate setup">
      <div className="modal-card">
        <button type="button" className="modal-close" aria-label="Close setup" onClick={onClose}>
          ×
        </button>
        <h2 className="modal-title">Become an affiliate</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          Step {step + 1} of 4 — {STEP_NAMES[step]}
        </p>
        <div style={{ display: "flex", gap: 6, margin: "10px 0 18px" }} aria-hidden="true">
          {STEP_NAMES.map((n, i) => (
            <span
              key={n}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 999,
                background: i <= step ? "#c9a227" : "rgba(13, 59, 55, 0.18)",
              }}
            />
          ))}
        </div>

        {step === 0 && (
          <div>
            <div
              style={{
                maxHeight: 300,
                overflowY: "auto",
                border: "1.5px solid var(--line)",
                borderRadius: 10,
                padding: "14px 16px",
                background: "#fffdf6",
                fontSize: "0.94rem",
                lineHeight: 1.55,
              }}
            >
              <p style={{ marginTop: 0 }}>
                These terms cover the eyeKnow affiliate program. You&apos;re joining as an
                independent promoter — not an employee or agent of eyeKnow.
              </p>
              <p>
                <b>What you earn.</b> 50% of every reading sold through your link, at the
                price you set; $3.00 for every book; $50 for a 1-year Timeline subscription
                and $100 for longer terms and lifetime. A sale counts when it is paid and
                completed through your link within 30 days of the visit.
              </p>
              <p>
                <b>What doesn&apos;t earn.</b> Your own purchases, $1 Timeline follow-up
                scans, and free readings or free gifts.
              </p>
              <p>
                <b>Payouts.</b> Request a payout from the Wallet tab. Payouts are issued as a
                virtual debit card loaded with your available balance. The card issuer may
                require identity details before a card can be issued; until then the request
                stays pending and your balance is untouched.
              </p>
              <p>
                <b>Your link name.</b> The link name you choose in this setup is permanent —
                it can&apos;t be changed later, so the links you share and the fliers you
                print keep working. Your original code link also keeps working.
              </p>
              <p>
                <b>Your price.</b> The reading price you set applies to future sales only.
              </p>
              <p>
                <b>Honest promotion.</b> Present eyeKnow as what it is — traditional
                iridology readings for interest and self-reflection. Never market it as
                medical advice, a diagnosis, or treatment; don&apos;t spam or mislead people
                to earn clicks; and don&apos;t imply you are an eyeKnow employee.
              </p>
              <p>
                <b>Fair dealing.</b> eyeKnow may withhold credit for fraudulent,
                self-referred, or manipulated sales, and may end participation for abuse of
                the program.
              </p>
              <p style={{ marginBottom: 0 }}>
                <b>Changes.</b> If these terms change materially, the new version will be
                presented before it applies.
              </p>
            </div>
            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                marginTop: 14,
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: 3, width: 18, height: 18 }}
              />
              I agree to the affiliate terms.
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn big"
                disabled={!agreed}
                onClick={() => setStep(1)}
              >
                Continue
              </button>
              <button type="button" className="textlink" onClick={onClose}>
                Not now
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p>
              Pick the name for your link — like <i>marie</i>, which makes your link{" "}
              <b>eyeknow.app/marie</b>. Use 3–30 lowercase letters, numbers, and hyphens.
            </p>
            <p className="warn" style={{ fontWeight: 600 }}>
              Choose carefully: your link name is permanent once setup finishes — it
              can&apos;t be changed later.
            </p>
            <label style={{ display: "grid", gap: 5, fontWeight: 600 }}>
              Link name
              <input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, ""));
                  setSlugError("");
                }}
                placeholder="e.g. marie"
                autoComplete="off"
                style={{
                  padding: "11px 12px",
                  border: "1.5px solid var(--line)",
                  borderRadius: 10,
                  font: "inherit",
                  background: "#fffdf6",
                }}
              />
            </label>
            <p className="muted" style={{ wordBreak: "break-all" }}>
              Your link: <b>eyeknow.app/{slug.trim() || "…"}</b>
            </p>
            {slugError && <p className="warn">{slugError}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={() => setStep(0)}>
                Back
              </button>
              <button
                type="button"
                className="btn big"
                disabled={checking || slug.trim().length < 3}
                onClick={() => void checkSlugAndContinue()}
              >
                {checking ? "Checking…" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p>
              Visitors who come through your link pay this price for a full reading, and each
              sale splits 50/50 with you. You can change it later from your dashboard —
              changes apply to future sales only. Books always stay $9.99 and always earn you
              $3.00, whatever this says.
            </p>
            <p>
              <b>{money(priceCents)}</b> per reading — your share{" "}
              <b>{money(Math.floor((priceCents + 1) / 2))}</b>
            </p>
            <input
              type="range"
              min={599}
              max={1999}
              step={1}
              value={priceCents}
              onChange={(e) => setPriceCents(Number(e.target.value))}
              style={{ width: "100%" }}
              aria-label="Reading price"
            />
            <div style={{ display: "flex", justifyContent: "space-between" }} className="muted">
              <span>$5.99</span>
              <span>$19.99</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="btn big" onClick={() => setStep(3)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ lineHeight: 1.55 }}>
              <p style={{ marginTop: 0 }}>
                <b>Lead with the free preview.</b> Everyone who opens your link can take a
                free preview reading first — no account, no card. It&apos;s the easiest yes
                you&apos;ll ever ask for.
              </p>
              <p>
                <b>Post with the toolbox.</b> In the Sharing section you&apos;ll find
                ready-made posts for your link — pick one, tweak the words, and share it
                anywhere. Your link rides along automatically, so sales credit to you.
              </p>
              <p>
                <b>Print your fliers.</b> Ten designs wait in the Sharing section too:
                full-page posters, quarter-page handouts, and wallet-size cards. The QR code
                on every one goes straight to your link.
              </p>
              <p>
                <b>Use the 10-free-readings hook.</b> Every full reading bought through your
                link comes with 10 free readings the buyer can share — one happy reader can
                send ten more visitors your way.
              </p>
              <p>
                <b>Gift it.</b> A paid gift reading bought through your link earns you the
                same split, and the recipient gets the full report.
              </p>
              <p>
                <b>Know your numbers.</b> Readings split 50/50 at your price ({money(priceCents)}{" "}
                earns you {money(Math.floor((priceCents + 1) / 2))}). Books earn $3.00 each.
                Timeline subscriptions earn $50 (1-year) or $100 (longer). Your balance
                builds in the Wallet, where you can request a payout as a virtual debit card.
              </p>
              <p style={{ marginBottom: 0 }}>
                <b>Keep it honest.</b> eyeKnow is a traditional reading for interest and
                self-reflection — never promote it as medical advice or a diagnosis. Honest
                posts build the audience that trusts your link.
              </p>
            </div>
            {finishError && <p className="warn">{finishError}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                type="button"
                className="btn big"
                disabled={finishing}
                onClick={() => void finish()}
              >
                {finishing ? "Finishing…" : "Finish setup"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
