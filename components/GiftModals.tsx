"use client";

import AffPrice from "./AffiliatePrice";

/** Gift-a-reading modals — the send form and the sent
 *  confirmation. Extracted from IrisApp (state stays there) to
 *  keep that file under the per-file upload cap. */
export default function GiftModals(props: {
  giftOpen: boolean;
  onCloseGift: () => void;
  onSubmitGift: (e: React.FormEvent) => void;
  gRecipName: string;
  setGRecipName: (v: string) => void;
  gRecipEmail: string;
  setGRecipEmail: (v: string) => void;
  gFromName: string;
  setGFromName: (v: string) => void;
  gMessage: string;
  setGMessage: (v: string) => void;
  gError: string;
  gBusy: boolean;
  giftDone: { email: string; url: string; emailSent: boolean } | null;
  onCloseDone: () => void;
  giftCopied: boolean;
  onCopyLink: () => void;
}) {
  const {
    giftOpen, onCloseGift, onSubmitGift,
    gRecipName, setGRecipName, gRecipEmail, setGRecipEmail,
    gFromName, setGFromName, gMessage, setGMessage, gError, gBusy,
    giftDone, onCloseDone, giftCopied, onCopyLink,
  } = props;
  return (
    <>
      {giftOpen && (
        <div
          className="modal-backdrop no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Gift a reading"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseGift();
          }}
        >
          <div className="modal-card">
            <button type="button" className="modal-close" aria-label="Close" onClick={() => onCloseGift()}>
              ×
            </button>
            <p className="report-brand">eyeKnow · Gift a reading</p>
            <h2 style={{ marginTop: 0 }}>Send a full reading as a gift — <AffPrice /></h2>
            <p className="muted" style={{ marginTop: -4 }}>
              They'll get an email with a personal link. They take their own eye scan and the
              complete report unlocks free — no account, no payment. One gift covers one
              reading, and it doesn't expire.
            </p>
            <form className="auth-form" onSubmit={(e) => void onSubmitGift(e)}>
              <label>
                Recipient's name
                <input value={gRecipName} onChange={(e) => setGRecipName(e.target.value)} placeholder="e.g. Maria" autoComplete="off" />
              </label>
              <label>
                Recipient's email
                <input type="email" required value={gRecipEmail} onChange={(e) => setGRecipEmail(e.target.value)} placeholder="them@example.com" autoComplete="off" />
              </label>
              <label>
                Your name
                <input value={gFromName} onChange={(e) => setGFromName(e.target.value)} placeholder="So they know it's from you" autoComplete="off" />
              </label>
              <label>
                A short message (optional)
                <textarea value={gMessage} onChange={(e) => setGMessage(e.target.value)} rows={3} maxLength={300} placeholder="Thought you'd enjoy this…" />
              </label>
              {gError && <p className="warn">{gError}</p>}
              <button type="submit" className="btn big" disabled={gBusy}>
                {gBusy ? "Opening checkout…" : <>Continue to payment — <AffPrice /></>}
              </button>
            </form>
          </div>
        </div>
      )}

      {giftDone && (
        <div className="modal-backdrop no-print" role="dialog" aria-modal="true" aria-label="Gift sent">
          <div className="modal-card">
            <button type="button" className="modal-close" aria-label="Close" onClick={() => onCloseDone()}>
              ×
            </button>
            <p className="report-brand">eyeKnow · Gift sent 🎁</p>
            <h2 style={{ marginTop: 0 }}>Your gift is on its way</h2>
            <p>
              {giftDone.emailSent ? (
                <>
                  We emailed the gift link to <b>{giftDone.email}</b>. Here's the same link, in
                  case you want to send it yourself too:
                </>
              ) : (
                <>
                  Your gift is paid and ready. Send <b>{giftDone.email || "your recipient"}</b>{" "}
                  this link — it's their gift:
                </>
              )}
            </p>
            <div className="gift-link-row">
              <code>{giftDone.url}</code>
              <button
                type="button"
                className="btn"
                onClick={onCopyLink}
              >
                {giftCopied ? "Copied ✓" : "Copy link"}
              </button>
            </div>
            <p className="muted">One gift covers one reading, and it doesn't expire.</p>
            <button type="button" className="btn big" onClick={() => onCloseDone()}>
              Done
            </button>
          </div>
        </div>
      )}

    </>
  );
}
