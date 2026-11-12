"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildPostArt, type PostArtId } from "./postArt";
import ContactSender from "./ContactSender";

/** Share toolbox for affiliates: ready-made posts they can pick
 *  from, tweak, and share — every button attaches the affiliate's
 *  own link, so anything bought through the post is credited to
 *  them. The promotional claims are the program's real offers:
 *  the free preview (top signs, no cost to look) and the 10 free
 *  shareable readings a full-reading purchase grants (webhook
 *  grants them on any reading purchase of $5.99 or more, affiliate
 *  prices included; $1 follow-ups and books grant none — no
 *  template claims otherwise). Prices in the copy come from the
 *  affiliate's saved price, never from the URL. */

interface ShareTemplate {
  id: string;
  name: string;
  blurb: string;
  subject: string;
  text: string;
  url: string;
}

export default function ShareToolbox({
  link,
  code,
  priceCents,
}: {
  link: string;
  code: string;
  priceCents: number;
}) {
  const price = (priceCents / 100).toFixed(2);
  const templates: ShareTemplate[] = useMemo(
    () => [
      {
        id: "reading",
        name: "Your reading",
        blurb: "The straightforward invite — what eyeKnow is and what a reading gives you.",
        subject: "eyeKnow — Traditional Iridology Readings",
        text: "Your eyes tell a story. eyeKnow reads the signs in your iris and maps them on a traditional iridology chart — a full report from one photo of your eye. See what yours says:",
        url: link,
      },
      {
        id: "preview",
        name: "Free preview",
        blurb: "Leads with the free preview — the easiest first step for someone new.",
        subject: "See the top signs in your iris — free preview",
        text: `Curious? Get a free preview of the top signs in your iris with eyeKnow — no cost to look. If you want the full reading, it's $${price} through my link:`,
        url: link,
      },
      {
        id: "freescans",
        name: "10 free readings",
        blurb: "The purchase perk: a full reading bought through your link includes 10 free readings the buyer can share.",
        subject: "Buy a reading, get 10 free readings to share",
        text: "Here's the deal I like best: buy a full eyeKnow reading through my link and you get 10 free readings to share with friends and family. One for you, ten to pass around:",
        url: link,
      },
      {
        id: "gift",
        name: "Gift a reading",
        blurb: "For gift-givers — a paid gift reading unlocks in full for the person who receives it.",
        subject: "Send an eyeKnow reading as a gift",
        text: "Need a gift that's actually different? Send someone a full eyeKnow iris reading — it arrives as a link, and they get their signs, a body map, and a traditional diet focus:",
        url: link,
      },
      {
        id: "timeline",
        name: "Timeline",
        blurb: "The repeat-scan story: start now, rescan later, and watch the signs change scan to scan.",
        subject: "Start your eyeKnow Timeline",
        text: "One reading is a snapshot — the Timeline makes it a story. eyeKnow compares every new scan of the same iris with the last one: what's new, what faded, what lightened a stage. And once your first reading is unlocked, follow-up scans are just $1. Start yours:",
        url: link,
      },
      {
        id: "subscription",
        name: "Subscription",
        blurb: "The Timeline subscription: weekly readings and a monthly overview written by a real person.",
        subject: "A reading of each iris, every week",
        text: "The eyeKnow Timeline subscription gives you a full reading of each iris every week, the comprehensive Timeline report across all of them, and a personal overview written by a real person each month. One payment per term — from $149 for a full year — never a renewing charge. See it here:",
        url: link,
      },
      {
        id: "bodymap",
        name: "Body map",
        blurb: "Feature spotlight: the interactive body map that lights up where your signs sit.",
        subject: "Your findings on an interactive body map",
        text: "My favorite part of an eyeKnow report: your findings lit up on an interactive body map. Tap a lit area and the signs that point there pop up, with the matching part of your iris highlighted. Take the free preview and see yours:",
        url: link,
      },
      {
        id: "diet",
        name: "Diet focus",
        blurb: "Feature spotlight: the traditional diet recommendations built from each reading.",
        subject: "Diet recommendations from your iris reading",
        text: "An eyeKnow reading ends with food: traditional diet recommendations built from your constitution, the areas your signs highlight, and your sign patterns — real foods, everyday eating, with a nutrient focus for each area. Get yours:",
        url: link,
      },
      {
        id: "constitution",
        name: "Constitution",
        blurb: "The curiosity hook: which traditional constitution type your iris colour carries.",
        subject: "What's your constitution type?",
        text: "Blue, brown, or mixed — in traditional iridology your iris colour carries your constitution type: lymphatic, hematogenic, or biliary, each with its own pattern of strengths. eyeKnow reads yours from one photo. Find out what type you are:",
        url: link,
      },
      {
        id: "books",
        name: "The books",
        blurb: "Kyle Jacob Butler's two books, $9.99 each — book sales through your link earn you $3.00 each.",
        subject: "Books by Kyle Jacob Butler, the eyeKnow developer",
        text: "Kyle Jacob Butler, the developer behind eyeKnow, also wrote two books — “The Ground We Stand On” and “The Trouble with English” — $9.99 each as instant downloads. Find them here:",
        url: `https://eyeknow.app/creator?ref=${code}`,
      },
    ],
    [link, code, price],
  );
  const [selectedId, setSelectedId] = useState(templates[0].id);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState<"" | "post" | "link">("");
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];
  const text = edited ?? selected.text;
  // Every shared version of a post states the affiliate's price
  // and ends with the affiliate's own link (Adam, 2026-11-01: a
  // share carrying neither isn't doing its job). Books and
  // subscription posts already state their own prices, so they
  // are exempt; the free-preview post already names the price in
  // its text, so it is not stated twice. shareText feeds every
  // text-carrying channel: native Share post, Copy post, Email,
  // Text, the X and WhatsApp text, and Send it personally.
  const priceLine =
    selected.id === "books" || selected.id === "subscription" || text.includes(`$${price}`)
      ? ""
      : ` The full reading is $${price} through my link.${priceCents < 1999 ? " (regularly $19.99)" : ""}`;
  const shareText = `${text}${priceLine}`;
  const fullText = `${shareText} ${selected.url}`;
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Each post has its own picture (components/postArt.ts), drawn
  // with the affiliate's link along the bottom. Regenerated when
  // the selected post or the link changes.
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const artCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const artForIdRef = useRef<string>("");
  const artUrlRef = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    buildPostArt(selected.id as PostArtId, link, { priceCents })
      .then((canvas) => {
        if (!live) return;
        artCanvasRef.current = canvas;
        artForIdRef.current = selected.id;
        canvas.toBlob((blob) => {
          if (!live || !blob) return;
          const url = URL.createObjectURL(blob);
          if (artUrlRef.current) URL.revokeObjectURL(artUrlRef.current);
          artUrlRef.current = url;
          setArtUrl(url);
        }, "image/png");
      })
      .catch(() => {
        if (live) setArtUrl(null);
      });
    return () => {
      live = false;
    };
  }, [selected.id, link, priceCents]);
  useEffect(
    () => () => {
      if (artUrlRef.current) URL.revokeObjectURL(artUrlRef.current);
    },
    [],
  );

  /** One tap, fully automatic: the post's picture as a file plus
   *  the post text (with the link) go to the phone's share sheet
   *  together, and the chosen app takes both — no copying, no
   *  saving, no pasting. The picture is built on demand if the
   *  preview hasn't finished drawing yet, so the button never
   *  silently degrades to a link-only share. When the device
   *  genuinely can't share files, it falls back to text + URL.
   *  (The Facebook / X / WhatsApp buttons work the other way:
   *  they share this post's /share/<post> link, whose preview
   *  picture IS this post's picture — see app/share/[id].) */
  async function shareWithPicture() {
    let canvas = artCanvasRef.current;
    if (!canvas || artForIdRef.current !== selected.id) {
      try {
        canvas = await buildPostArt(selected.id as PostArtId, link, { priceCents });
        artCanvasRef.current = canvas;
        artForIdRef.current = selected.id;
      } catch {
        canvas = null;
      }
    }
    if (canvas) {
      const blob = await new Promise<Blob | null>((r) => canvas!.toBlob(r, "image/png"));
      if (blob) {
        const file = new File([blob], `eyeknow-post-${selected.id}.png`, { type: "image/png" });
        const data = { files: [file], title: selected.subject, text: fullText };
        // canShare missing (some web views) → try anyway and let
        // the share call itself refuse; a dismissal stops here.
        const allowed =
          typeof navigator.canShare === "function" ? navigator.canShare(data) : true;
        if (allowed) {
          try {
            await navigator.share(data);
            return;
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return;
            /* files refused — fall through to the plain share */
          }
        }
      }
    }
    try {
      await navigator.share({ title: selected.subject, text, url: selected.url });
    } catch {
      /* user dismissed the sheet */
    }
  }

  // Link-preview shares (Facebook, X, WhatsApp) show the picture
  // from the SHARED page's own preview tags — so those buttons use
  // this post's /share/<post> link, whose page carries this post's
  // picture and headline. The ref rides along and the landing sets
  // the same referral cookies, so credit works exactly as with the
  // raw affiliate link.
  const shareUrl = `https://eyeknow.app/share/${selected.id}?ref=${code}`;

  const targets = [
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
    },
    {
      name: "Email",
      href: `mailto:?subject=${encodeURIComponent(selected.subject)}&body=${encodeURIComponent(fullText)}`,
    },
    {
      name: "Text",
      href: `sms:?&body=${encodeURIComponent(fullText)}`,
    },
  ];

  function copy(value: string, which: "post" | "link") {
    const done = () => {
      setCopied(which);
      setTimeout(() => setCopied(""), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(done);
    } else {
      done();
    }
  }

  return (
    <div>
      <label>
        Choose a post
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setEdited(null);
          }}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            marginBottom: 10,
            padding: "9px 10px",
            fontSize: 16,
          }}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <p className="muted" style={{ marginBottom: 8 }}>{selected.blurb}</p>
      {artUrl ? (
        <img
          src={artUrl}
          alt={`Picture for the “${selected.name}” post`}
          style={{
            display: "block",
            width: "100%",
            maxWidth: 300,
            margin: "2px auto 12px",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(13, 59, 55, 0.22)",
          }}
        />
      ) : (
        <p className="muted">Preparing this post&apos;s picture…</p>
      )}
      <label>
        Your post
        <textarea
          value={text}
          onChange={(e) => setEdited(e.target.value)}
          rows={4}
          style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px" }}
        />
      </label>
      {edited !== null && (
        <button
          type="button"
          className="btn"
          onClick={() => setEdited(null)}
          style={{ marginTop: 6 }}
        >
          Reset to the original wording
        </button>
      )}
      <p className="muted" style={{ margin: "10px 0 6px" }}>
        Your link is attached to every share: <b style={{ wordBreak: "break-all" }}>{selected.url}</b>
      </p>
      {priceCents < 1999 && selected.id !== "books" && selected.id !== "subscription" && (
        <p style={{ margin: "2px 0 8px" }}>
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 999,
              border: "1px solid #c9a227",
              background: "rgba(201,162,39,0.14)",
              fontSize: 14,
            }}
          >
            <s>$19.99</s> <b>${price}</b> — your discount rides on this post&apos;s picture
            and in its words
          </span>
        </p>
      )}
      <div className="share-row">
        <span className="share-label">Share this post</span>
        <div className="share-btns">
          {canNativeShare && (
            <button
              type="button"
              className="share-btn"
              onClick={() => void shareWithPicture()}
              style={{ background: "#c9a227", color: "#17251f", borderColor: "#c9a227", fontWeight: 700 }}
            >
              Share post
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
          <button type="button" className="share-btn" onClick={() => copy(fullText, "post")}>
            {copied === "post" ? "Copied ✓" : "Copy post"}
          </button>
          <button type="button" className="share-btn" onClick={() => copy(selected.url, "link")}>
            {copied === "link" ? "Copied ✓" : "Copy link"}
          </button>
          {artUrl && (
            <a className="share-btn" href={artUrl} download={`eyeknow-post-${selected.id}.png`}>
              Save image
            </a>
          )}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
        Tap <b>Share post</b> and pick where it&apos;s going — the picture and the words
        travel together, nothing to copy or save. The Facebook, X and WhatsApp buttons
        use this post&apos;s own share link, so the picture those sites pull in is this
        post&apos;s picture, with your credit attached.
      </p>
      <ContactSender code={code} url={selected.url} message={shareText} />
    </div>
  );
}
