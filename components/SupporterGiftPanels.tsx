// Early-supporter gift panels: the buyer's 10 shareable basic readings.
// Shared by the account history panel and the unlocked-report panel.

import { useEffect, useState } from "react";
import { withReferral } from "./ReferralCapture";

export type SupporterGiftLink = { url: string; status: string };

type PanelProps = {
  links: SupporterGiftLink[];
  copied: string | null;
  onCopy: (url: string) => void;
};

function SupporterLinkRows({ links, copied, onCopy }: PanelProps) {
  // Gift links carry the sharer's affiliate attribution, like every
  // other share link: the recipient lands with the affiliate cookie
  // set and the affiliate's pricing in effect.
  const [decorated, setDecorated] = useState(links);
  useEffect(() => {
    setDecorated(links.map((g) => ({ ...g, url: withReferral(g.url) })));
  }, [links]);
  return (
    <>
      {decorated.map((g) => (
        <div key={g.url} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <input
            readOnly
            value={g.url}
            aria-label="Basic reading share link"
            style={{ flex: 1, minWidth: 0 }}
            onFocus={(e) => e.target.select()}
          />
          {g.status === "redeemed" ? (
            <span>✓ Redeemed</span>
          ) : (
            <button type="button" className="btn" onClick={() => onCopy(g.url)}>
              {copied === g.url ? "Copied ✓" : "Copy link"}
            </button>
          )}
        </div>
      ))}
    </>
  );
}

export function AccountSupporterPanel({ links, copied, onCopy }: PanelProps) {
  return (
    <section className="panel gift-panel no-print" style={{ marginBottom: 16 }}>
      <h2>🎁 Your 10 free basic readings to share</h2>
      <p className="muted">
        Thank you for supporting eyeKnow early — each link gives a friend or family
        member a free basic reading (the top 5 signs) and 10% off the full unlock.
        A used link shows as redeemed.
      </p>
      <div>
        <SupporterLinkRows links={links} copied={copied} onCopy={onCopy} />
      </div>
    </section>
  );
}

export function ReportSupporterPanel({ links, copied, onCopy }: PanelProps) {
  return (
    <div className="shared-bar gift-bar no-print" style={{ display: "block" }}>
      <span>
        🎁 <b>Your 10 free basic readings to share</b> — thank you for supporting eyeKnow
        early. Each link gives a friend or family member a free basic reading and 10%
        off the full unlock.
      </span>
      <div style={{ marginTop: 10 }}>
        <SupporterLinkRows links={links} copied={copied} onCopy={onCopy} />
      </div>
    </div>
  );
}
