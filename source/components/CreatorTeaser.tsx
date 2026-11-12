"use client";

import { useState } from "react";
import AppDiagnostics from "./AppDiagnostics";
import { BOOKS, type BookDisplay } from "./bookCatalog";
import { getReferralCode } from "./ReferralCapture";

// Creator & books, as ONE modal (Adam, 2026-11-05): the homepage
// "Meet Kyle" section is gone — replaced by the Palm Reading ad —
// and this modal now opens from the round "?" button floating on
// the river in the footer. It carries the creator bio and both
// books; a book opens its own detail modal with the same $9.99
// checkout as the creator page.
export function CreatorBooksModal({ onClose }: { onClose: () => void }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const openBook = BOOKS.find((b) => b.slug === openSlug) ?? null;

  async function buy(slug: string) {
    setBuying(true);
    setBuyError(null);
    try {
      const res = await fetch("/api/books/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookSlug: slug, ref: getReferralCode() ?? undefined }),
      });
      const d = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (res.ok && d?.url) {
        window.location.href = d.url;
        return;
      }
      setBuyError(d?.error ?? "Checkout couldn't start — try again in a moment.");
    } catch {
      setBuyError("Checkout couldn't start — try again in a moment.");
    } finally {
      setBuying(false);
    }
  }

  function closeBook() {
    setOpenSlug(null);
    setBuyError(null);
  }

  return (
    <>
      <div
        className="modal-backdrop no-print"
        role="dialog"
        aria-modal="true"
        aria-label="Meet the developer and his books"
        onClick={onClose}
      >
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/creator-portrait.jpg"
            alt="Woodcut portrait illustration of Kyle Jacob Butler, developer of eyeKnow"
            style={{ width: 160, maxWidth: "100%", borderRadius: 14, display: "block", marginBottom: 14 }}
          />
          <h2 className="modal-title" style={{ marginTop: 0 }}>
            Meet Kyle Jacob Butler
          </h2>
          <p>
            Kyle Jacob Butler is the developer of eyeKnow. He built the app to make traditional
            iridology readings available to anyone with a phone camera — fully automatic: take a
            photo of your eye and the reading comes back, no appointment, no waiting room.
          </p>
          <p className="muted">
            eyeKnow is still being developed, and it can make mistakes sometimes. Every reading
            is a traditional interpretation, offered for interest and self-reflection — never a
            diagnosis, never medical advice.
          </p>
          <h3 style={{ marginBottom: 8 }}>His books</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {BOOKS.map((book) => (
              <button
                key={book.slug}
                type="button"
                onClick={() => setOpenSlug(book.slug)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  background: "rgba(217, 164, 65, 0.08)",
                  border: "1px solid rgba(128, 118, 84, 0.4)",
                  borderRadius: 12,
                  padding: "8px 12px",
                  cursor: "pointer",
                  color: "var(--ink)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={book.cover}
                  alt=""
                  aria-hidden="true"
                  style={{ width: 40, height: 64, objectFit: "cover", borderRadius: 6, flex: "none" }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: "0.95rem" }}>
                    {book.title}
                  </span>
                  <span
                    style={{
                      display: "block",
                      color: "var(--ink-soft)",
                      fontSize: "0.82rem",
                      marginTop: 1,
                    }}
                  >
                    {book.pages} · Tap to open
                  </span>
                </span>
              </button>
            ))}
          </div>
          <AppDiagnostics />
        </div>
      </div>
      {openBook && (
        <BookModal
          book={openBook}
          buying={buying}
          buyError={buyError}
          onBuy={() => void buy(openBook.slug)}
          onClose={closeBook}
        />
      )}
    </>
  );
}

function BookModal({
  book,
  buying,
  buyError,
  onBuy,
  onClose,
}: {
  book: BookDisplay;
  buying: boolean;
  buyError: string | null;
  onBuy: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop no-print"
      role="dialog"
      aria-modal="true"
      aria-label={book.title}
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={book.cover}
          alt={`Cover of ${book.title} by Kyle Jacob Butler`}
          style={{ width: 150, maxWidth: "100%", borderRadius: 10, display: "block", margin: "0 auto 12px" }}
        />
        <h2 className="modal-title" style={{ marginTop: 0 }}>
          {book.title}
        </h2>
        <p className="muted" style={{ marginTop: -8 }}>
          by Kyle Jacob Butler · {book.pages}
        </p>
        <p>
          <b>{book.lead}</b>
        </p>
        {book.body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
        <ul>
          {book.points.map((pt) => (
            <li key={pt}>{pt}</li>
          ))}
        </ul>
        <p>{book.who}</p>
        <button type="button" className="btn big" disabled={buying} onClick={onBuy}>
          {buying ? "Opening checkout…" : "Buy the PDF — $9.99"}
        </button>
        {buyError && <p className="warn">{buyError}</p>}
        <p className="muted" style={{ marginBottom: 0 }}>
          One-time payment, handled securely by Stripe. The PDF downloads right after payment.
        </p>
      </div>
    </div>
  );
}
