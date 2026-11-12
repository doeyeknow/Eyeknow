"use client";

import { useEffect, useState } from "react";

/** Send it personally: the affiliate picks the people, the app
 *  lines them up one at a time, and each "Text" button opens the
 *  phone's own messages app with that person addressed and the
 *  post pre-written. THE AFFILIATE SENDS EVERY MESSAGE — nothing
 *  is sent by the app, nothing is automated, and no contact data
 *  ever leaves the phone (the list lives in this browser's local
 *  storage, keyed to the affiliate's code). People are added ONLY
 *  through the Contact Picker API (Adam, 2026-11-02: the manual
 *  name/number inputs were removed). Where the browser offers no
 *  picker — notably iPhone, where Apple offers websites no
 *  address-book access — the section says so plainly and there is
 *  no add path. The message carries the affiliate's OWN link
 *  (eyeknow.app/<name>) and the post text states their price, so
 *  a personal text shows both; the link preview a messaging app
 *  draws is the site's standard preview picture. */

type Person = { name: string; tel: string; status: "waiting" | "sent" | "skipped" };

function normalizeTel(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

function firstNameOf(name: string): string {
  return (name || "").trim().split(/\s+/)[0] ?? "";
}

export default function ContactSender({
  code,
  url,
  message,
}: {
  code: string;
  url: string;
  message: string;
}) {
  const storageKey = `eyeknow-contact-queue-${code}`;
  const [people, setPeople] = useState<Person[]>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as Person[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [personalize, setPersonalize] = useState(true);
  const pickerSupported =
    typeof navigator !== "undefined" && "contacts" in navigator;

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(people));
    } catch {
      /* private mode etc. — the queue just won't persist */
    }
  }, [people, storageKey]);

  const currentIdx = people.findIndex((p) => p.status === "waiting");
  const sentCount = people.filter((p) => p.status === "sent").length;
  const waitingCount = people.filter((p) => p.status === "waiting").length;

  function bodyFor(p: Person): string {
    const first = firstNameOf(p.name);
    const greet =
      personalize && first && !/^(hi|hey|hello)\b/i.test(message.trim())
        ? `Hi ${first}, `
        : "";
    return `${greet}${message} ${url}`;
  }

  function addPeople(entries: Array<{ name: string; tel: string }>) {
    setPeople((prev) => {
      const seen = new Set(prev.map((p) => p.tel));
      const next = [...prev];
      for (const e of entries) {
        const tel = normalizeTel(e.tel);
        if (tel.replace(/\D/g, "").length < 7 || seen.has(tel)) continue;
        seen.add(tel);
        next.push({ name: e.name.trim(), tel, status: "waiting" });
      }
      return next;
    });
  }

  async function pickContacts() {
    try {
      const picked = await (navigator as unknown as {
        contacts: {
          select: (
            props: string[],
            opts: { multiple: boolean },
          ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
        };
      }).contacts.select(["name", "tel"], { multiple: true });
      addPeople(
        picked.flatMap((c) =>
          (c.tel ?? []).map((tel) => ({ name: c.name?.[0] ?? "", tel })),
        ),
      );
    } catch {
      /* picker dismissed — nothing to add */
    }
  }

  function setStatus(idx: number, status: Person["status"]) {
    setPeople((prev) => prev.map((p, i) => (i === idx ? { ...p, status } : p)));
  }

  return (
    <div style={{ marginTop: 18, borderTop: "1px solid rgba(13,59,55,0.18)", paddingTop: 14 }}>
      <p style={{ margin: "0 0 4px" }}>
        <b>Send it personally</b>
      </p>
      <p className="muted" style={{ marginTop: 0 }}>
        Sending to people you know beats posting to strangers. Pick who should get this
        post and the app lines them up one at a time — each button opens your own
        messages app with the text written and your link in it. <b>You tap send on every
        single one</b>; nothing is sent for you. The list stays on this phone only.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {pickerSupported && (
          <button type="button" className="btn" onClick={() => void pickContacts()}>
            Select from contacts
          </button>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={personalize}
            onChange={(e) => setPersonalize(e.target.checked)}
          />
          Start each text with their first name
        </label>
      </div>
      {!pickerSupported && (
        <p className="muted" style={{ marginTop: 0 }}>
          This browser doesn&apos;t offer contact picking — on iPhone, Apple
          doesn&apos;t let websites open your address book. Contact picking works in
          Chrome on Android.
        </p>
      )}

      {people.length > 0 && (
        <>
          <p style={{ margin: "14px 0 6px" }}>
            <b>
              {sentCount} of {people.length} sent
            </b>
            {waitingCount === 0 && sentCount > 0 ? " — list finished 🎉" : ""}
          </p>
          {waitingCount > 25 && (
            <p className="muted" style={{ marginTop: 0 }}>
              That&apos;s a long list — personal texts work best in small batches of
              people who know you.
            </p>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {people.map((p, i) => {
              const isCurrent = i === currentIdx;
              return (
                <li
                  key={`${p.tel}-${i}`}
                  style={{
                    padding: "8px 10px",
                    marginBottom: 6,
                    borderRadius: 8,
                    border: isCurrent
                      ? "2px solid #c9a227"
                      : "1px solid rgba(13,59,55,0.18)",
                    background: isCurrent ? "rgba(201,162,39,0.08)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span>
                      {p.status === "sent" ? "✓ " : p.status === "skipped" ? "— " : "• "}
                      <b>{p.name || p.tel}</b>
                      {p.name ? <span className="muted"> · {p.tel}</span> : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPeople((prev) => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}
                      aria-label={`Remove ${p.name || p.tel}`}
                    >
                      Remove
                    </button>
                  </div>
                  {isCurrent && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <a
                        className="btn"
                        href={`sms:${p.tel}?&body=${encodeURIComponent(bodyFor(p))}`}
                        style={{ background: "#c9a227", color: "#17251f", fontWeight: 700 }}
                      >
                        Text {firstNameOf(p.name) || p.tel}
                      </a>
                      <button type="button" className="btn" onClick={() => setStatus(i, "sent")}>
                        Sent ✓ — next
                      </button>
                      <button type="button" className="btn" onClick={() => setStatus(i, "skipped")}>
                        Skip
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn"
              onClick={() =>
                setPeople((prev) => prev.map((p) => ({ ...p, status: "waiting" })))
              }
            >
              Start the list again
            </button>
            <button type="button" className="btn" onClick={() => setPeople([])}>
              Clear list
            </button>
          </div>
        </>
      )}
    </div>
  );
}
