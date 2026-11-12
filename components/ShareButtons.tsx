"use client";

import { useEffect, useState } from "react";
import { withReferral } from "./ReferralCapture";

// Share row: native share sheet where available, plus direct targets.
// No third-party widgets or trackers — plain links only.
// variant="modal" renders ONE share button that opens a popup modal
// listing the methods — the footer form (Adam, 2026-11-05: a single
// button fitted in the water, methods in a popup).
export default function ShareButtons({
  url,
  title,
  text,
  label,
  variant,
  iconOnly,
}: {
  url: string;
  title: string;
  text: string;
  label: string;
  variant?: "row" | "modal";
  /** Modal variant with a round share-icon trigger instead of the
   *  text pill — the homepage water row (Adam, 2026-11-05). */
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  // Shares carry the sharer's affiliate attribution (when they have
  // one): the ref is appended after mount, once ReferralCapture has
  // stored any just-landed reference.
  const [shareUrl, setShareUrl] = useState(url);
  useEffect(() => {
    setShareUrl(withReferral(url));
  }, [url]);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`${text} ${shareUrl}`);
  const targets = [
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedText}`,
    },
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}`,
    },
    {
      name: "Email",
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}`,
    },
    {
      name: "Text",
      href: `sms:?&body=${encodedText}`,
    },
  ];
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  function nativeShare() {
    navigator.share({ title, text, url: shareUrl }).catch(() => {
      /* user dismissed the sheet */
    });
  }

  function copyLink() {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).then(done).catch(done);
    } else {
      done();
    }
  }

  if (variant === "modal") {
    return (
      <div className="share-row">
        {iconOnly ? (
          <button
            type="button"
            className="water-icon-btn"
            aria-label={label}
            onClick={() => setOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M8.4 10.7 14.7 6.8M8.4 13.3l6.3 3.9" />
              <circle cx="6" cy="12" r="2.7" fill="currentColor" stroke="none" />
              <circle cx="17" cy="5.6" r="2.7" fill="currentColor" stroke="none" />
              <circle cx="17" cy="18.4" r="2.7" fill="currentColor" stroke="none" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="share-btn share-open-btn"
            onClick={() => setOpen(true)}
          >
            ↗ {label}
          </button>
        )}
        {open && (
          <div
            className="modal-backdrop no-print"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={() => setOpen(false)}
          >
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="modal-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h2 className="modal-title" style={{ marginTop: 0 }}>
                {label}
              </h2>
              <div className="share-methods">
                {canNativeShare && (
                  <button type="button" className="share-method" onClick={nativeShare}>
                    Share…
                  </button>
                )}
                {targets.map((t) => (
                  <a
                    key={t.name}
                    className="share-method"
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    {t.name}
                  </a>
                ))}
                <button type="button" className="share-method" onClick={copyLink}>
                  {copied ? "Copied ✓" : "Copy link"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="share-row">
      <span className="share-label">{label}</span>
      <div className="share-btns">
        {canNativeShare && (
          <button type="button" className="share-btn" onClick={nativeShare}>
            Share…
          </button>
        )}
        {targets.map((t) => (
          <a
            key={t.name}
            className="share-btn"
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.name}
          </a>
        ))}
        <button type="button" className="share-btn" onClick={copyLink}>
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
