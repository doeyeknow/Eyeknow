"use client";

import { useEffect, useState } from "react";
import { BOOKS } from "@/components/bookCatalog";
import { getReferralCode } from "@/components/ReferralCapture";
import ReferralCapture from "@/components/ReferralCapture";

import AppDiagnostics from "../../components/AppDiagnostics";
/** Creator page: Kyle Jacob Butler, who built eyeKnow, plus
 *  the book store — two PDF books by Kyle Jacob Butler, $9.99
 *  each, sold through Stripe Checkout with webhook-only
 *  fulfillment. No reading prices appear here. */



export default function CreatorPage() {
  const [buying, setBuying] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [bought, setBought] = useState<{ title: string; downloadUrl: string } | null>(null);
  const [settling, setSettling] = useState(false);
  const [owned, setOwned] = useState<{ bookSlug: string; title: string; downloadUrl: string }[]>([]);

  // Returning from a book purchase? Verify server-side, then show
  // the download (or a settling note while the webhook lands).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("book_bought") === "success") {
      const sid = params.get("session_id");
      window.history.replaceState({}, "", window.location.pathname);
      if (!sid) return;
      void (async () => {
        const res = await fetch("/api/books/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
        }).catch(() => null);
        const d = res ? ((await res.json().catch(() => null)) as { ok?: boolean; settling?: boolean; title?: string; downloadUrl?: string } | null) : null;
        if (res?.ok && d?.ok && d.downloadUrl) {
          setBought({ title: d.title ?? "Your book", downloadUrl: d.downloadUrl });
        } else if (d?.settling) {
          setSettling(true);
        }
      })();
    }
  }, []);

  // A signed-in buyer's earlier book purchases.
  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/books").catch(() => null);
      if (!res?.ok) return;
      const d = (await res.json().catch(() => null)) as { books?: { bookSlug: string; title: string; downloadUrl: string }[] } | null;
      if (d?.books) setOwned(d.books);
    })();
  }, []);

  async function buy(slug: string) {
    setBuying(slug);
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
      setBuying(null);
    }
  }

  return (
    <div className="app">
      {/* Capture a ?ref= landing here too (affiliate book posts link
          straight to this page), so the code is stored before the
          buy buttons read it at checkout. */}
      <ReferralCapture />
      <header className="topbar2 no-print">
        <div className="tb-side">
          <a
            className="brand tb-brand"
            href="/"
            aria-label="eyeKnow home"
            style={{ textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="" aria-hidden="true" />
            <span>
              eye<b className="brand-know">Know</b>
            </span>
          </a>
        </div>
        <div className="tb-center" aria-live="polite" />
        <div className="tb-side tb-right">
          <a className="tb-next" href="/" style={{ textDecoration: "none" }}>
            Back to eyeKnow
          </a>
        </div>
      </header>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 80px" }}>
      <section className="panel" style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/creator-portrait.jpg"
          alt="Portrait of Kyle Jacob Butler, the developer of eyeKnow"
          style={{ width: 220, maxWidth: "100%", borderRadius: 14 }}
        />
        <div style={{ flex: "1 1 300px" }}>
          <h1 style={{ marginTop: 0 }}>Meet Kyle Jacob Butler</h1>
          <p>
            Kyle Jacob Butler is the developer of eyeKnow. He built the app to make traditional iridology
            readings available to anyone with a phone camera — fully automatic: take a photo
            of your eye and the reading comes back, no appointment, no waiting room.
          </p>
          <p className="muted">
            eyeKnow is still being developed, and it can make mistakes sometimes. Every reading
            is a traditional interpretation, offered for interest and self-reflection — never a
            diagnosis, never medical advice.
          </p>
        </div>
      </section>

      {bought && (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>Thank you — your book is ready</h2>
          <p>
            <b>{bought.title}</b> is yours. Download it now — the link stays valid, so you can
            come back for it any time.
          </p>
          <a className="btn big" href={bought.downloadUrl}>
            Download {bought.title} (PDF)
          </a>
        </section>
      )}
      {settling && !bought && (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>Payment received — your book is on its way</h2>
          <p>
            Your payment is still settling (usually seconds). Refresh this page in a moment and
            your download will appear here.
          </p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Refresh
          </button>
        </section>
      )}
      {owned.length > 0 && (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>Your books</h2>
          <p className="muted">Books you&apos;ve bought, ready to download again any time.</p>
          {owned.map((b) => (
            <p key={b.bookSlug}>
              <b>{b.title}</b> — <a href={b.downloadUrl}>Download PDF</a>
            </p>
          ))}
        </section>
      )}

      <h2 style={{ marginTop: 32 }}>Books by Kyle Jacob Butler</h2>
      {BOOKS.map((book) => (
        <section key={book.slug} className="panel" style={{ marginTop: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={book.cover}
            alt={`Cover of ${book.title} by Kyle Jacob Butler`}
            style={{ width: 200, maxWidth: "100%", borderRadius: 10, display: "block", marginBottom: 12 }}
          />
          <h3 style={{ marginTop: 0 }}>{book.title}</h3>
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
          <button
            type="button"
            className="btn big"
            disabled={buying === book.slug}
            onClick={() => void buy(book.slug)}
          >
            {buying === book.slug ? "Opening checkout…" : `Buy the PDF — $9.99`}
          </button>
          {buyError && buying === null && <p className="warn">{buyError}</p>}
          <p className="muted" style={{ marginBottom: 0 }}>
            One-time payment, handled securely by Stripe. The PDF downloads right after payment.
          </p>
        </section>
      ))}

      <p className="muted" style={{ marginTop: 28 }}>
        eyeKnow — traditional iridology readings for interest and self-reflection. Not medical
        advice.
      </p>
      <AppDiagnostics />
      </main>
    </div>
  );
}
