"use client";

import { useEffect, useState } from "react";

// Homepage reviews section (Adam, 2026-11-05): "Hear what others
// are saying about eyeKnow" — one review at a time, cycling every
// 5 seconds (dots jump straight to one; reduced motion = no
// auto-cycle). Real visitor reviews come from /api/reviews once
// the owner approves them in /admin; until the first approval the
// section shows starter reviews written in the voice Adam
// directed (doubted the tech, scanned anyway, couldn't believe
// the accuracy). The "Share your vision" button opens a
// submission form — submissions go to the admin dashboard as
// pending and never appear here until approved.
interface Review {
  stars: number;
  text: string;
  name: string;
  context: string;
}

const SEED_REVIEWS: Review[] = [
  {
    stars: 5,
    text: "I'll be honest, I thought this was a gimmick. A phone camera reading my eye? I only scanned because the preview was free. Then it described my temperament — the feeling-led part, how I burn out when I push too long — better than I could have myself. I unlocked the full report before I'd even finished reading the preview.",
    name: "Marisa T.",
    context: "First scan",
  },
  {
    stars: 5,
    text: "I'm an engineer. I don't do this stuff. My sister sent me her link and I scanned mostly to prove it was random. It wasn't random. The constitution reading and the areas it flagged lined up with things I've known about myself for years. Still not sure how I feel about that.",
    name: "Daniel K.",
    context: "Scanned both eyes",
  },
  {
    stars: 5,
    text: "The preview alone named the two areas I would have picked myself. Then the full findings — especially the colour stages, and what each tone means — I kept saying 'that's me' out loud. My husband scanned his the same night.",
    name: "Priya S.",
    context: "Unlocked the full reading",
  },
  {
    stars: 5,
    text: "Doubted every word of this before I tried it. The scan took about a minute, and the reading nailed my drive, my energy dips, even the pattern of my temperament. I've rescanned twice since, just to watch my signs on the Timeline.",
    name: "Jordan M.",
    context: "Scans every few months",
  },
];

export default function Reviews() {
  const [list, setList] = useState<Review[]>(SEED_REVIEWS);
  const [idx, setIdx] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/reviews")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { reviews?: Review[] } | null) => {
        if (live && d?.reviews && d.reviews.length > 0) {
          setList(d.reviews);
          setIdx(0);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), 5000);
    return () => clearInterval(t);
  }, [list.length]);

  return (
    <section className="panel" aria-label="Reviews" style={{ paddingBottom: "calc(200px + env(safe-area-inset-bottom))" }}>
      <p className="kicker">Reviews</p>
      <h2>See what others are seeing</h2>
      <div style={{ display: "grid", marginTop: 14 }}>
        {list.map((r, i) => (
          <figure
            className="review-card"
            key={`${r.name}-${i}`}
            aria-hidden={i !== idx}
            style={{
              gridArea: "1 / 1",
              opacity: i === idx ? 1 : 0,
              transition: "opacity 0.7s ease",
              pointerEvents: i === idx ? "auto" : "none",
            }}
          >
            <div className="review-stars" aria-label={`${r.stars} out of 5 stars`}>
              {"★".repeat(r.stars)}
            </div>
            <blockquote>{r.text}</blockquote>
            <figcaption>
              <b>{r.name}</b>
              {r.context ? ` · ${r.context}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
      <div style={{ display: "flex", gap: 7, justifyContent: "center", marginTop: 12 }}>
        {list.map((r, i) => (
          <button
            key={`${r.name}-${i}`}
            type="button"
            aria-label={`Show review ${i + 1}`}
            onClick={() => setIdx(i)}
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              border: "none",
              padding: 0,
              cursor: "pointer",
              background: i === idx ? "#d9a441" : "rgba(128, 118, 84, 0.35)",
            }}
          />
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <button type="button" className="btn ghost" onClick={() => setFormOpen(true)}>
          ✎ Share your vision
        </button>
      </div>
      {formOpen && <ReviewForm onClose={() => setFormOpen(false)} />}
    </section>
  );
}

function ReviewForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, context, stars, text }),
      });
      const d = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) {
        setSent(true);
        return;
      }
      setError(d?.error ?? "Could not send your review — try again in a moment.");
    } catch {
      setError("Could not send your review — try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="modal-backdrop no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Share your vision"
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="modal-title" style={{ marginTop: 0 }}>
          Share your vision
        </h2>
        {sent ? (
          <>
            <p className="auth-note">
              Thank you — your review is in. Every review gets a quick look before it
              appears here, so it will show up soon.
            </p>
            <button type="button" className="btn big" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <form className="auth-form" onSubmit={(e) => void submit(e)}>
            <label>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex R."
                maxLength={60}
                required
              />
            </label>
            <label>
              Your rating
              <span style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setStars(n)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 2,
                      cursor: "pointer",
                      fontSize: "1.6rem",
                      lineHeight: 1,
                      color: n <= stars ? "#d9a441" : "rgba(128, 118, 84, 0.35)",
                    }}
                  >
                    ★
                  </button>
                ))}
              </span>
            </label>
            <label>
              About your scan <span style={{ fontWeight: 400 }}>(optional)</span>
              <input
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g. First scan · Unlocked the full reading"
                maxLength={60}
              />
            </label>
            <label>
              Your review
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What did you think of your reading?"
                maxLength={1200}
                rows={5}
                required
                style={{
                  padding: "11px 12px",
                  border: "1.5px solid var(--line)",
                  borderRadius: 10,
                  font: "inherit",
                  background: "#fffdf6",
                  color: "var(--ink)",
                  resize: "vertical",
                }}
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn big" disabled={sending}>
              {sending ? "Sending…" : "Send review"}
            </button>
            <p className="muted" style={{ margin: 0 }}>
              Reviews are checked before they appear on this page.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
