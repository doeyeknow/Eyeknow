"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// (useRef also tracks the one-time cloud import below)
import ReportView from "./ReportView";
import RevealSlides from "./RevealSlides";
import PurchaseReveal from "./PurchaseReveal";
import ReadingsList from "./ReadingsList";
import GiftModals from "./GiftModals";
import { StageOverlay } from "./StageOverlay";
import { HERO_EYE_SRCS, useHeroColorIndex } from "./heroColor";
import { groupPersons, missingEye, personIdOf, withPersonUnlock, type PersonGroup } from "@/lib/person";
import CoverCards from "./CoverCards";
import ShareButtons from "./ShareButtons";
import LogoEye from "./LogoEye";
import Galaxy from "./Galaxy";
import GalaxyMenu from "./GalaxyMenu";
import HomeScene from "./HomeScene";

// Stripe publishable key (safe to expose). When set, checkout renders
// INSIDE the app (embedded) instead of redirecting to Stripe's page.
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
import { EXAMPLE_CHAIN, EXAMPLE_SCAN } from "@/lib/example";
import { autoRead, IrisDetectionError } from "@/lib/autoread";
import { captureEyePhoto, setTorch } from "@/lib/capture";
import CaptureTips from "./CaptureTips";
import BottomNav from "./BottomNav";
import HowModal from "./HowModal";
import InstallToast from "./InstallToast";
import { CreatorBooksModal } from "./CreatorTeaser";
import PalmPromo from "./PalmPromo";
import Reviews from "./Reviews";
import JoinTeam from "./JoinTeam";
import ScrollFx from "./ScrollFx";
import ReferralCapture, { getReferralCode } from "./ReferralCapture";
import AffPrice from "./AffiliatePrice";
import CheckoutModal from "./CheckoutModal";
import { MiniReadCycle, ReportPreviewCycle, ScanDemo, TimelinePreviewCycle } from "./DemoCycles";
import { AccountSupporterPanel, ReportSupporterPanel } from "./SupporterGiftPanels";
import type { EyeSide, ScanRecord } from "@/lib/chart";

const LS_KEY = "irisread_scans_v1";
const MAX_SAVED = 12;

type View = "home" | "history" | "report" | "intro";
type Step = "capture" | "reading";

/** Reading steps in order; `visual` selects the step's animation
 *  (see StageOverlay). Enhancement runs first, on Adam's direction —
 *  the image is lifted and contrast-adjusted before any detection. */
const READ_STAGES: { label: string; visual: number }[] = [
  { label: "Enhancing the image & adjusting contrast…", visual: 3 },
  { label: "Locating your pupil…", visual: 0 },
  { label: "Tracing the edge of your iris…", visual: 1 },
  { label: "Unrolling the iris onto the chart…", visual: 2 },
  { label: "Scanning for nerve rings…", visual: 4 },
  { label: "Hunting dark & white markings…", visual: 5 },
  { label: "Reading radial lines & fiber texture…", visual: 6 },
  { label: "Placing every sign on the chart…", visual: 7 },
  { label: "Writing your report…", visual: 8 },
];
const READ_STAGE_MS = 850;

const TAB_ORDER = ["overview", "findings", "bodymap", "diet", "timeline", "notes"] as const;
type ReportTab = (typeof TAB_ORDER)[number];
const TAB_LABELS: Record<ReportTab, string> = {
  overview: "Overview",
  bodymap: "Body Map",
  findings: "Findings",
  diet: "Diet",
  timeline: "Timeline",
  notes: "Notes",
};

/** Decorative detection spots for the "hunting markings" step. */

/** SVG path for one 30° clock-sector wedge of the iris (r 45, gap 2°). */

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

function loadSaved(): ScanRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScanRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** fetch with a hard timeout — a stalled request on a flaky
 *  connection must surface as an error, never an endless spinner
 *  (Adam's "stuck at opening checkout" report, 2026-10-23). */
async function fetchTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    window.clearTimeout(t);
  }
}

export default function IrisApp() {
  // The front-page colour cycle — the How It Works photograph eye
  // matches the hero like every other demo eye (Adam, 2026-11-05).
  const heroEyeIdx = useHeroColorIndex();
  const [view, setView] = useState<View>("home");
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState<Step>("capture");
  const [saved, setSaved] = useState<ScanRecord[]>([]);
  const [viewing, setViewing] = useState<ScanRecord | null>(null);
  // Accounts: when signed in, readings live in the account (cloud).
  const [account, setAccount] = useState<{
    configured: boolean;
    user: { id: string; email: string } | null;
    admin?: boolean;
    googleConfigured?: boolean;
  } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  const [exampleIdx, setExampleIdx] = useState(0);
  const [exampleStage, setExampleStage] = useState(0);
  const [exampleAnimating, setExampleAnimating] = useState(false);
  const [exampleBarShown, setExampleBarShown] = useState(false);

  // The example always starts on its first scan.
  useEffect(() => {
    if (exampleOpen) setExampleIdx(0);
  }, [exampleOpen]);

  // Opening the example plays the scanning animation first, then
  // the report; its top bar slides in halfway through the scroll.
  useEffect(() => {
    if (!exampleOpen) return;
    setExampleBarShown(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setExampleAnimating(false);
      return;
    }
    setExampleAnimating(true);
    setExampleStage(0);
    let s = 0;
    const iv = window.setInterval(() => {
      s += 1;
      if (s >= READ_STAGES.length) {
        window.clearInterval(iv);
        window.setTimeout(() => setExampleAnimating(false), 950);
      } else {
        setExampleStage(s);
      }
    }, READ_STAGE_MS);
    return () => window.clearInterval(iv);
  }, [exampleOpen]);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [sharedLink, setSharedLink] = useState<{ id: string; token: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authNote, setAuthNote] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);
  const [checkoutStalled, setCheckoutStalled] = useState(false);
  const [accountPop, setAccountPop] = useState(false);
  const [reportTab, setReportTab] = useState<ReportTab>("overview");
  /** When set, the scan flow is a Timeline follow-up of this reading:
   *  the eye is locked to match and the new record joins its chain. */
  const [rescanBase, setRescanBase] = useState<ScanRecord | null>(null);
  const [pairBase, setPairBase] = useState<ScanRecord | null>(null);
  const pendingPrintRef = useRef(false);
  const tabIntentRef = useRef<ReportTab | null>(null);

  // A newly opened reading always starts on Overview — unless the
  // readings-list menu asked for a specific section (Findings /
  // Body map), which is consumed here exactly once.
  useEffect(() => {
    if (tabIntentRef.current) {
      setReportTab(tabIntentRef.current);
      tabIntentRef.current = null;
    } else {
      setReportTab("overview");
    }
  }, [viewing?.id]);

  // "Print report" from the readings-list menu: once the report
  // is on screen, open the print dialog for it.
  useEffect(() => {
    if (view !== "report" || !pendingPrintRef.current) return;
    pendingPrintRef.current = false;
    const t = window.setTimeout(() => window.print(), 900);
    return () => window.clearTimeout(t);
  }, [view, viewing?.id]);

  // Landing on a page starts at the top (e.g. going Home while
  // scrolled deep in a report or the readings list).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);
  const [checkoutKind, setCheckoutKind] = useState<"unlock" | "gift">("unlock");
  const [finaleUnlock, setFinaleUnlock] = useState(false);
  const [unlockAsk, setUnlockAsk] = useState(0);
  // The tier of the unlock in flight — the hosted-checkout fallback
  // must keep it (a stalled $3 basic checkout used to restart as a
  // full-price one; Adam, 2026-11-05).
  const [unlockTier, setUnlockTier] = useState<"full" | "basic">("full");
  // Gift a reading
  const [giftOpen, setGiftOpen] = useState(false);
  const [gRecipName, setGRecipName] = useState("");
  const [gRecipEmail, setGRecipEmail] = useState("");
  const [gFromName, setGFromName] = useState("");
  const [gMessage, setGMessage] = useState("");
  const [gError, setGError] = useState("");
  const [gBusy, setGBusy] = useState(false);
  const [giftDone, setGiftDone] = useState<{ email: string; url: string; emailSent: boolean } | null>(null);
  const [giftCopied, setGiftCopied] = useState(false);
  const [pendingGift, setPendingGift] = useState<string | null>(null);
  const [giftInfo, setGiftInfo] = useState<{ fromName?: string | null; message?: string | null } | null>(null);
  const pendingGiftRef = useRef<string | null>(null);

  useEffect(() => {
    pendingGiftRef.current = pendingGift;
  }, [pendingGift]);
  // A free early-supporter reading (?supporter=<token>): same shape
  // as a paid gift — it auto-applies to the next scan, or to a
  // locked reading you already have.
  const [pendingSupporter, setPendingSupporter] = useState<string | null>(null);
  const pendingSupporterRef = useRef<string | null>(null);

  useEffect(() => {
    pendingSupporterRef.current = pendingSupporter;
  }, [pendingSupporter]);
  // The buyer's own 10 share links (account area) and a guest
  // purchase's links (recovered by the reading's credential).
  const [supporterLinks, setSupporterLinks] = useState<{ url: string; status: string }[] | null>(null);
  const [supporterScanLinks, setSupporterScanLinks] = useState<{ url: string; status: string }[] | null>(null);
  const [supporterCopied, setSupporterCopied] = useState<string | null>(null);
  // Post-purchase "deeper reading" reveal: set when a checkout return
  // verifies as unlocked; the overlay runs its sequence, then closes
  // onto the already-open full report.
  const [reveal, setReveal] = useState<ScanRecord | null>(null);
  // Post-scan reveal (Adam, 2026-11-05): the excitement sequence
  // shown right after a fresh scan, before its report. Follow-up
  // (Timeline rescan) completions skip it.
  const [introScan, setIntroScan] = useState<ScanRecord | null>(null);
  const [introFromLibrary, setIntroFromLibrary] = useState(false);
  const [revealStage, setRevealStage] = useState(0);

  useEffect(() => {
    if (!reveal) return;
    setRevealStage(0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const iv = window.setInterval(
      () => setRevealStage((s) => Math.min(s + 1, 6)),
      reduced ? 300 : 1150,
    );
    return () => window.clearInterval(iv);
  }, [reveal]);

  useEffect(() => {
    if (reveal && revealStage >= 6) {
      const t = window.setTimeout(() => setReveal(null), 1000);
      return () => window.clearTimeout(t);
    }
  }, [reveal, revealStage]);
  const checkoutMountRef = useRef<HTMLDivElement | null>(null);
  const embeddedRef = useRef<{ destroy: () => void } | null>(null);

  // Mount Stripe's embedded checkout form when a client secret arrives.
  useEffect(() => {
    if (!checkoutSecret || !STRIPE_PK) return;
    let live = true;
    setCheckoutStalled(false);
    // If Stripe's form hasn't mounted in 12s (blocked or crawling
    // connection), say so and offer the standard checkout instead of
    // an empty box that spins forever.
    const stallTimer = window.setTimeout(() => {
      if (live && !embeddedRef.current) setCheckoutStalled(true);
    }, 12000);
    (async () => {
      try {
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(STRIPE_PK);
        if (!stripe || !live || !checkoutMountRef.current) {
          if (live && !stripe) setCheckoutStalled(true);
          return;
        }
        const instance = await stripe.createEmbeddedCheckoutPage({
          clientSecret: checkoutSecret,
        });
        if (!live) {
          instance.destroy();
          return;
        }
        embeddedRef.current = instance;
        instance.mount(checkoutMountRef.current);
      } catch {
        if (live) setCheckoutStalled(true);
      }
    })();
    return () => {
      live = false;
      window.clearTimeout(stallTimer);
      embeddedRef.current?.destroy();
      embeddedRef.current = null;
    };
  }, [checkoutSecret]);
  const [unlockNote, setUnlockNote] = useState<string | null>(null);
  const importTriedRef = useRef(false);

  const [eye, setEye] = useState<EyeSide>("right");
  const [readStage, setReadStage] = useState(0);
  const [readError, setReadError] = useState<string | null>(null);
  const [foundCount, setFoundCount] = useState<number | null>(null);
  const [readImage, setReadImage] = useState<string | null>(null);

  // camera
  const [camOn, setCamOn] = useState(false);
  const [camMode, setCamMode] = useState<"user" | "environment">("user");
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const timersRef = useRef<number[]>([]);

  // "Install app": the browser's own prompt, when offered. The
  // layout head script catches an offer fired before hydration and
  // stashes it on window.__eyeknowBIP; adopt it, then keep listening.
  const [installEvt, setInstallEvt] = useState<Event | null>(null);
  useEffect(() => {
    const w = window as unknown as { __eyeknowBIP?: Event | null };
    if (w.__eyeknowBIP) setInstallEvt(w.__eyeknowBIP);
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    const onStash = () => { if (w.__eyeknowBIP) setInstallEvt(w.__eyeknowBIP); };
    const onGone = () => setInstallEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("eyeknow-bip", onStash);
    window.addEventListener("appinstalled", onGone);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("eyeknow-bip", onStash);
      window.removeEventListener("appinstalled", onGone);
    };
  }, []);

  // Installed-app (standalone display mode) detection.
  const [standalone, setStandalone] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const f = () =>
      setStandalone(
        mq.matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true,
      );
    f();
    mq.addEventListener("change", f);
    const onInstalled = () => setJustInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      mq.removeEventListener("change", f);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Register the service worker so eyeKnow can be installed as an app.
  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* installability is a bonus; the site works without it */
      });
    }
  }, []);

  // Arrived via a gift link (?gift=<token>)? Stash the gift on this
  // device; it auto-applies to the next scan (or can be applied to
  // an existing locked reading).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("gift");
    if (token) {
      void (async () => {
        const res = await fetch(`/api/gifts?token=${encodeURIComponent(token)}`).catch(() => null);
        if (res?.ok) {
          const d = (await res.json()) as { status?: string; fromName?: string | null; message?: string | null };
          if (d.status === "paid") {
            setPendingGift(token);
            setGiftInfo({ fromName: d.fromName, message: d.message });
            try {
              localStorage.setItem("eyeknow_gift", token);
            } catch { /* ignore */ }
          } else if (d.status === "redeemed") {
            setLinkNote("That gift was already used — one gift covers one reading.");
          } else {
            setLinkNote("That gift hasn't been paid for yet.");
          }
        } else {
          setLinkNote("That gift link doesn't look right.");
        }
        window.history.replaceState({}, "", window.location.pathname);
      })();
      return;
    }
    try {
      const stored = localStorage.getItem("eyeknow_gift");
      if (stored) {
        setPendingGift(stored);
        void (async () => {
          const res = await fetch(`/api/gifts?token=${encodeURIComponent(stored)}`).catch(() => null);
          if (res?.ok) {
            const d = (await res.json()) as { status?: string; fromName?: string | null; message?: string | null };
            if (d.status === "paid") setGiftInfo({ fromName: d.fromName, message: d.message });
            else {
              setPendingGift(null);
              localStorage.removeItem("eyeknow_gift");
            }
          }
        })();
      }
    } catch { /* ignore */ }
  }, []);

  // Arrived via a free early-supporter link (?supporter=<token>)?
  // Same stash-and-apply shape as a paid gift link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("supporter");
    if (token) {
      void (async () => {
        const res = await fetch("/api/gifts/early?token=" + encodeURIComponent(token)).catch(() => null);
        if (res?.ok) {
          const d = (await res.json()) as { status?: string };
          if (d.status === "granted") {
            setPendingSupporter(token);
            try {
              localStorage.setItem("eyeknow_supporter", token);
            } catch { /* ignore */ }
          } else if (d.status === "redeemed") {
            setLinkNote("That free reading was already used — one link covers one reading.");
          }
        } else {
          setLinkNote("That free-reading link doesn't look right.");
        }
        window.history.replaceState({}, "", window.location.pathname);
      })();
      return;
    }
    try {
      const stored = localStorage.getItem("eyeknow_supporter");
      if (stored) {
        setPendingSupporter(stored);
        void (async () => {
          const res = await fetch("/api/gifts/early?token=" + encodeURIComponent(stored)).catch(() => null);
          if (!res?.ok) {
            setPendingSupporter(null);
            localStorage.removeItem("eyeknow_supporter");
          } else {
            const d = (await res.json()) as { status?: string };
            if (d.status !== "granted") {
              setPendingSupporter(null);
              localStorage.removeItem("eyeknow_supporter");
            }
          }
        })();
      }
    } catch { /* ignore */ }
  }, []);

  // Buyer's 10 share links for the account area.
  useEffect(() => {
    if (view !== "history" || !account?.user) {
      setSupporterLinks(null);
      return;
    }
    let alive = true;
    void (async () => {
      const res = await fetch("/api/gifts/early").catch(() => null);
      if (!alive || !res?.ok) return;
      const d = (await res.json().catch(() => null)) as { gifts?: { url: string; status: string }[] } | null;
      if (d?.gifts) setSupporterLinks(d.gifts);
    })();
    return () => {
      alive = false;
    };
  }, [view, account?.user]);

  // A guest purchase's 10 share links, recovered by the reading's
  // own credential (the same trust model as the reading itself).
  useEffect(() => {
    if (!viewing || view !== "report" || !viewing.unlocked || !viewing.accessToken) {
      setSupporterScanLinks(null);
      return;
    }
    let alive = true;
    void (async () => {
      const res = await fetch(
        `/api/gifts/early?scanId=${encodeURIComponent(viewing.id)}&accessToken=${encodeURIComponent(viewing.accessToken ?? "")}`,
      ).catch(() => null);
      if (!alive || !res?.ok) return;
      const d = (await res.json().catch(() => null)) as { gifts?: { url: string; status: string }[] } | null;
      if (d?.gifts?.length) setSupporterScanLinks(d.gifts);
    })();
    return () => {
      alive = false;
    };
  }, [view, viewing?.id, viewing?.accessToken, viewing?.unlocked]);

  // Returning from buying a gift (?gift_bought=success)? Verify the
  // payment, which flips the gift to paid and emails the recipient.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bought = params.get("gift_bought");
    if (bought === "success") {
      const g = params.get("g");
      const gt = params.get("gt");
      const sid = params.get("session_id");
      if (g && sid) {
        void (async () => {
          const res = await fetch("/api/checkout/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: sid, giftId: g, giftToken: gt }),
          }).catch(() => null);
          const d = res ? ((await res.json().catch(() => null)) as { ok?: boolean; recipientEmail?: string; emailSent?: boolean } | null) : null;
          if (res?.ok && d?.ok) {
            setGiftDone({
              email: d.recipientEmail ?? "",
              url: `${window.location.origin}/?gift=${gt ?? ""}`,
              emailSent: Boolean(d.emailSent),
            });
          } else {
            setLinkNote("Your gift payment is still settling — the gift email goes out as soon as it confirms, and the gift link from checkout works either way.");
          }
          window.history.replaceState({}, "", window.location.pathname);
        })();
      }
    } else if (bought === "cancelled") {
      setLinkNote("Gift purchase cancelled — no charge was made.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Arrived via a printed report's QR link (?scan=<id>&t=<token>)?
    // The token opens the reading with NO account. A guest purchase
    // return (?checkout=success) verifies first, then opens it.
    const linkParams = new URLSearchParams(window.location.search);
    const linkId = linkParams.get("scan");
    const linkToken = linkParams.get("t");
    if (linkId && linkToken && linkParams.get("checkout") !== "cancelled") {
      void (async () => {
        try {
          if (linkParams.get("checkout") === "success") {
            const sid = linkParams.get("session_id");
            if (sid) {
              await fetch("/api/checkout/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: sid, scanId: linkId, accessToken: linkToken }),
              }).catch(() => undefined);
            }
          }
          const res = await fetch(
            `/api/scans/shared?id=${encodeURIComponent(linkId)}&t=${encodeURIComponent(linkToken)}`,
          ).catch(() => null);
          if (res?.ok) {
            const d = (await res.json()) as { scan: ScanRecord };
            setSharedLink({ id: linkId, token: linkToken });
            setViewing(d.scan);
            setView("report");
            if (linkParams.get("checkout") === "success" && d.scan.unlocked) {
              setReveal(d.scan);
            }
          }
        } catch {
          /* a bad link simply lands on the home page */
        }
        window.history.replaceState({}, "", window.location.pathname);
      })();
    }
    const local = loadSaved();
    setSaved(local);
    // Backfill link tokens for device readings that predate them.
    const localTokens = ensureTokens(local);
    if (localTokens.patched.length > 0) {
      setSaved(localTokens.list);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(localTokens.list.slice(0, MAX_SAVED)));
      } catch {
        /* storage full */
      }
    }
    // If accounts are live and this device is signed in, the
    // account's readings take over (device readings import once).
    void (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = (await res.json()) as {
          configured: boolean;
          user: { id: string; email: string } | null;
          googleConfigured?: boolean;
        };
        setAccount(data);
        // Returning from Google sign-in with a reading to reopen?
        const earlyParams = new URLSearchParams(window.location.search);
        if (!data.user && earlyParams.get("auth") === "error") {
          setAuthMode("login");
          setAuthError("Google sign-in didn't complete — try again.");
          setAuthOpen(true);
          window.history.replaceState({}, "", window.location.pathname);
        }
        // Arrived via a printed report's QR link while signed out:
        // remember the reading and prompt sign-in; it opens after.
        if (
          !data.user &&
          data.configured &&
          earlyParams.get("scan") &&
          !earlyParams.get("checkout")
        ) {
          try {
            localStorage.setItem("eyeknow_pending_scan", earlyParams.get("scan")!);
          } catch {
            /* storage unavailable */
          }
          setAuthMode("login");
          setAuthNote("Sign in to open your reading — then you can unlock the full report.");
          setAuthOpen(true);
          window.history.replaceState({}, "", window.location.pathname);
        }
        if (data.user) {
          const cloud = await loadCloudScans(local);
          await runPendingClaim();
          if (!earlyParams.get("checkout") && earlyParams.get("scan")) {
            const target = cloud?.find((s) => s.id === earlyParams.get("scan"));
            if (target) {
              setViewing(target);
              setView("report");
            }
            window.history.replaceState({}, "", window.location.pathname);
          }
          // Returning from Stripe checkout?
          const params = new URLSearchParams(window.location.search);
          const checkout = params.get("checkout");
          const scanId = params.get("scan");
          if (checkout === "success" && scanId) {
            const sessionId = params.get("session_id");
            if (sessionId) {
              await fetch("/api/checkout/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
              }).catch(() => undefined);
            }
            const fresh = (await loadCloudScans(local)) ?? cloud;
            const target = fresh?.find((s) => s.id === scanId);
            if (target) {
              setViewing(target);
              setView("report");
              if (target.unlocked) {
                setUnlockNote(null);
                setReveal(target);
              }
            }
          }
          if (checkout) {
            window.history.replaceState({}, "", window.location.pathname);
          }
        }
      } catch {
        /* accounts unreachable — device-local behavior */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Self-heal: if the launch-time account check never landed (a
  // network hiccup leaves the account state unknown — and readings
  // used to fail OPEN in that state), keep retrying while it's
  // unknown so sign-in and cloud sync recover on their own.
  const accountUnknown = account === null;
  useEffect(() => {
    if (!accountUnknown) return;
    let cancelled = false;
    const tryAgain = async () => {
      try {
        const res = await fetchTimeout("/api/auth/me", {}, 10000);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          configured: boolean;
          user: { id: string; email: string } | null;
          googleConfigured?: boolean;
        };
        if (cancelled) return;
        setAccount(data);
        if (data.user) {
          await loadCloudScans(loadSaved());
          await runPendingClaim();
        }
      } catch {
        /* still unknown — the paywall stays closed meanwhile */
      }
    };
    void tryAgain();
    const iv = window.setInterval(() => void tryAgain(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountUnknown]);

  function mirrorLocal(list: ScanRecord[]) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
    } catch {
      /* storage full — cloud copy is authoritative while signed in */
    }
  }

  async function loadCloudScans(local: ScanRecord[]): Promise<ScanRecord[] | null> {
    try {
      const res = await fetch("/api/scans");
      if (!res.ok) return null;
      let cloud = ((await res.json()) as { scans: ScanRecord[] }).scans ?? [];
      if (!importTriedRef.current) {
        importTriedRef.current = true;
        const cloudIds = new Set(cloud.map((s) => s.id));
        const missing = local.filter((s) => !cloudIds.has(s.id));
        if (missing.length > 0) {
          await fetch("/api/scans/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scans: missing }),
          }).catch(() => undefined);
          const res2 = await fetch("/api/scans");
          if (res2.ok) cloud = ((await res2.json()) as { scans: ScanRecord[] }).scans ?? cloud;
        }
      }
      setSaved(cloud);
      mirrorLocal(cloud);
      // Printed-report QR link landing: open the linked reading.
      try {
        const pid = localStorage.getItem("eyeknow_pending_scan");
        if (pid) {
          localStorage.removeItem("eyeknow_pending_scan");
          const hit = cloud.find((s) => s.id === pid);
          if (hit) {
            setViewing(hit);
            setView("report");
          } else {
            setLinkNote(
              "That reading link belongs to a different account — it opens when you're signed in with the account that created the reading.",
            );
          }
        }
      } catch {
        /* storage unavailable */
      }
      // Backfill link tokens for account readings that predate them.
      const { list: withTokens, patched } = ensureTokens(cloud);
      if (patched.length > 0) {
        setSaved(withTokens);
        mirrorLocal(withTokens);
        for (const p of patched) {
          void fetch("/api/scans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          }).catch(() => undefined);
        }
        return withTokens;
      }
      return cloud;
    } catch {
      return null;
    }
  }

  /** Register the shared (QR-link) copy of a reading server-side. */
  async function registerShared(scan: ScanRecord) {
    if (!scan.accessToken) return;
    try {
      await fetch("/api/scans/shared", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan, accessToken: scan.accessToken }),
      });
    } catch {
      /* the link resolves once a later registration lands */
    }
  }

  /** Readings from before link tokens get one, so their printed
   *  reports carry a working QR code too. */
  function ensureTokens(list: ScanRecord[]): { list: ScanRecord[]; patched: ScanRecord[] } {
    const patched: ScanRecord[] = [];
    const out = list.map((s) => {
      if (s.accessToken) return s;
      const p = { ...s, accessToken: `${uid()}-${uid()}` };
      patched.push(p);
      return p;
    });
    for (const p of patched) void registerShared(p);
    return { list: out, patched };
  }

  /** After sign-in, finish a pending "save this shared reading to
   *  my account" that was started from a QR link while signed out. */
  async function runPendingClaim() {
    try {
      const raw = localStorage.getItem("eyeknow_pending_claim");
      if (!raw) return;
      localStorage.removeItem("eyeknow_pending_claim");
      const { id, token } = JSON.parse(raw) as { id: string; token: string };
      const res = await fetch("/api/scans/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: id, accessToken: token }),
      });
      if (!res.ok) return;
      const cloud = await loadCloudScans(loadSaved());
      const mine = cloud?.find((s) => s.id === id);
      if (mine) {
        setSharedLink(null);
        setViewing(mine);
        setView("report");
        setLinkNote("Saved to your account ✓ — find it any time under My readings.");
      }
    } catch {
      /* claim is a convenience; the shared link keeps working */
    }
  }

  /** Save the shared reading currently open into the viewer's
   *  account (signing in first if needed). */
  async function saveSharedToAccount() {
    if (!viewing || !sharedLink) return;
    if (!account?.user) {
      try {
        localStorage.setItem(
          "eyeknow_pending_claim",
          JSON.stringify({ id: viewing.id, token: sharedLink.token }),
        );
      } catch {
        /* storage unavailable */
      }
      setAuthMode("register");
      setAuthError("");
      setAuthNote("Create an account (or sign in) and this reading is saved into it — unlocked state and all.");
      setAuthOpen(true);
      return;
    }
    const res = await fetch("/api/scans/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanId: viewing.id, accessToken: sharedLink.token }),
    }).catch(() => null);
    if (res?.ok) {
      const cloud = await loadCloudScans(loadSaved());
      const mine = cloud?.find((s) => s.id === viewing.id);
      if (mine) setViewing(mine);
      setSharedLink(null);
      setLinkNote("Saved to your account ✓ — find it any time under My readings.");
    }
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      const res = await fetch(authMode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: { id: string; email: string };
        error?: string;
      };
      if (!res.ok || !data.user) {
        setAuthError(data.error ?? "Something went wrong — try again.");
        return;
      }
      setAccount({ configured: true, user: data.user });
      setAuthOpen(false);
      setAuthPassword("");
      setAuthNote("");
      importTriedRef.current = false;
      const cloud = await loadCloudScans(loadSaved());
      // If a reading is open, swap it for its account copy (its
      // unlock state is authoritative there).
      if (viewing && cloud) {
        const twin = cloud.find((s) => s.id === viewing.id);
        if (twin) setViewing(twin);
      }
      await runPendingClaim();
    } catch {
      setAuthError("Couldn't reach the account service — try again in a moment.");
    } finally {
      setAuthBusy(false);
    }
  }

  const doInstall = () => {
    const evt = installEvt as unknown as {
      prompt: () => void;
      userChoice: Promise<unknown>;
    } | null;
    if (!evt) return;
    (window as unknown as { __eyeknowBIP?: Event | null }).__eyeknowBIP = null;
    evt.prompt();
    void evt.userChoice.finally(() => setInstallEvt(null));
    setAccountPop(false);
  };
  const openAuth = (mode: "login" | "register") => {
    setAccountPop(false);
    setAuthMode(mode);
    setAuthError("");
    setAuthOpen(true);
  };

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccount({ configured: true, user: null });
    setSaved(loadSaved());
  }

  /** Stripe unlock for the reading currently open — the full
   *  reading, or the $3 basic tier when kind is "basic"
   *  (Adam, 2026-11-05). */
  async function unlockViewing(
    forceHosted = false,
    kind: "full" | "basic" = "full",
    target?: ScanRecord,
  ) {
    setCheckoutKind("unlock");
    setUnlockTier(kind);
    const scan = target ?? viewing;
    if (!scan) return;
    // Shared-link guest checkout (not in this device's list).
    if (
      !target &&
      viewing &&
      sharedLink &&
      sharedLink.id === viewing.id &&
      !saved.some((s) => s.id === viewing.id)
    ) {
      setUnlockBusy(true);
      setUnlockNote(null);
      try {
        const res = await fetchTimeout("/api/checkout/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scanId: viewing.id,
            accessToken: sharedLink.token,
            embedded: !forceHosted && Boolean(STRIPE_PK),
            ref: getReferralCode() ?? undefined,
            ...(kind === "basic" ? { kind: "basic" } : {}),
          }),
        }, 25000);
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          clientSecret?: string;
          alreadyUnlocked?: boolean;
          alreadyBasic?: boolean;
          error?: string;
        };
        if (data.alreadyUnlocked || data.alreadyBasic) {
          const r = await fetchTimeout(
            `/api/scans/shared?id=${encodeURIComponent(viewing.id)}&t=${encodeURIComponent(sharedLink.token)}`,
            {},
            10000,
          ).catch(() => null);
          if (r?.ok) setViewing(((await r.json()) as { scan: ScanRecord }).scan);
          return;
        }
        if (data.clientSecret) {
          setCheckoutSecret(data.clientSecret);
          return;
        }
        if (!res.ok || !data.url) {
          setUnlockNote(data.error ?? "Checkout couldn't start — try again in a moment.");
          return;
        }
        window.location.href = data.url;
        return;
      } catch {
        setUnlockNote("Couldn't reach checkout — try again in a moment.");
        return;
      } finally {
        setUnlockBusy(false);
      }
    }
    if (!account?.user) {
      setAuthMode("login");
      setAuthError("");
      setAuthNote("Sign in or create an account first — your unlocked reading is stored in your account so you can open it on any device.");
      setAuthOpen(true);
      return;
    }
    setUnlockBusy(true);
    setUnlockNote(null);
    try {
      // Save the reading to the account before checkout.
      await fetchTimeout("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scan),
      }, 10000).catch(() => undefined);
      const res = await fetchTimeout("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: scan.id, embedded: !forceHosted && Boolean(STRIPE_PK), ref: getReferralCode() ?? undefined, ...(kind === "basic" ? { kind: "basic" } : {}) }),
      }, 25000);
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        clientSecret?: string;
        alreadyUnlocked?: boolean;
        alreadyBasic?: boolean;
        error?: string;
      };
      if (data.alreadyUnlocked || data.alreadyBasic) {
        const cloud = await loadCloudScans(loadSaved());
        const twin = cloud?.find((s) => s.id === scan.id);
        if (twin) setViewing(twin);
        if (introScan) {
          setIntroScan(null);
          setView("report");
        }
        return;
      }
      if (data.clientSecret) {
        setCheckoutSecret(data.clientSecret);
        return;
      }
      if (!res.ok || !data.url) {
        setUnlockNote(data.error ?? "Checkout couldn't start — try again in a moment.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setUnlockNote("Checkout couldn't start — check your connection and try again.");
    } finally {
      setUnlockBusy(false);
    }
  }

  /** The My readings card's unlock button (Adam, 2026-11-06). */
  function unlockPersonFromLibrary(person: PersonGroup, tier: "basic" | "full") {
    const rep = person.scans[0];
    if (!rep) return;
    setViewing(rep);
    void unlockViewing(false, tier, rep);
  }

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(
    async (mode: "user" | "environment") => {
      setCamError(null);
      try {
        stopCamera();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 2560 }, height: { ideal: 2560 } },
          audio: false,
        });
        streamRef.current = stream;
        // Rear camera: torch on — more light, less sensor noise.
        if (mode === "environment") void setTorch(stream, true);
        setCamOn(true);
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play().catch(() => {});
          }
        });
      } catch {
        setCamError(
          "Camera isn't available here — check the browser's camera permission, or upload a close-up eye photo instead.",
        );
        setCamOn(false);
      }
    },
    [stopCamera],
  );

  async function snapPhoto() {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || video.videoWidth === 0 || !stream) return;
    // Full-res stills where offered, else a burst (see lib/capture).
    const cap = await captureEyePhoto(video, stream, camMode === "user");
    stopCamera();
    if (cap) void runRead(cap.display, cap.analysis, cap.stackedFrames);
  }

  function onUpload(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => void runRead(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function runRead(src: string, analysisSrc?: string, stackedFrames?: number) {
    // Fresh upload: start at the top.
    window.scrollTo({ top: 0 });
    setStep("reading");
    setReadError(null);
    setFoundCount(null);
    setReadStage(0);
    setReadImage(src);
    timersRef.current.forEach((t) => window.clearTimeout(t));
    // The step show runs on its own clock; the report opens when
    // BOTH the real reading and the animation have finished.
    const animDone = new Promise<void>((resolve) => {
      timersRef.current = READ_STAGES.slice(1).map((_, i) =>
        window.setTimeout(() => setReadStage(i + 1), READ_STAGE_MS * (i + 1)),
      );
      timersRef.current.push(
        window.setTimeout(resolve, READ_STAGE_MS * READ_STAGES.length),
      );
    });
    try {
      // Let the reading screen paint before the heavy pixel work starts.
      await new Promise((r) => setTimeout(r, 60));
      const result = await autoRead(src, { analysisSrc, stackedFrames });
      const record: ScanRecord = {
        id: uid(),
        createdAt: Date.now(),
        accessToken: `${uid()}-${uid()}`,
        eye,
        color: result.color,
        image: result.image,
        markers: result.markers,
        profile: result.profile,
        ...(rescanBase
          ? {
              baseId: rescanBase.baseId ?? rescanBase.id,
              prevId: rescanBase.id,
              personId: personIdOf(rescanBase),
              ...(rescanBase.personName ? { personName: rescanBase.personName } : {}),
            }
          : pairBase
            ? {
                personId: personIdOf(pairBase),
                ...(pairBase.personName ? { personName: pairBase.personName } : {}),
              }
            : {}),
        auto: {
          overallConfidence: result.overallConfidence,
          notes: result.notes,
          qualityNotes: result.qualityNotes,
        },
      };
      // Signed in → the reading saves to the account; otherwise it
      // stays on this device, as before.
      let next: ScanRecord[];
      if (account?.user) {
        let cloudOk = false;
        try {
          const res = await fetch("/api/scans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(record),
          });
          cloudOk = res.ok;
        } catch {
          cloudOk = false;
        }
        next = [record, ...saved.filter((s) => s.id !== record.id)];
        setSaved(next);
        if (cloudOk) mirrorLocal(next);
        else {
          try {
            localStorage.setItem(LS_KEY, JSON.stringify(next.slice(0, MAX_SAVED)));
          } catch {
            /* storage full — the reading still shows */
          }
        }
      } else {
        next = [record, ...saved].slice(0, MAX_SAVED);
        setSaved(next);
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(next));
        } catch {
          /* storage full — the reading still shows */
        }
      }
      void registerShared(record);
      setFoundCount(result.markers.length);
      await animDone;
      // A stashed gift unlocks this brand-new reading automatically
      // (registration lands first so the unlock sticks server-side).
      let finalRecord = record;
      // A pair scan for an already-unlocked person is covered by
      // that unlock — it opens in full.
      if (
        pairBase &&
        saved.some((s) => personIdOf(s) === personIdOf(pairBase) && s.unlocked)
      ) {
        finalRecord = { ...record, unlocked: true };
      }
      if (pendingGiftRef.current) {
        await registerShared(record);
        if (await redeemPendingGift(record.id)) {
          finalRecord = { ...record, unlocked: true };
          const fixed = next.map((s) => (s.id === record.id ? finalRecord : s));
          setSaved(fixed);
          try {
            localStorage.setItem(LS_KEY, JSON.stringify(fixed.slice(0, MAX_SAVED)));
          } catch { /* storage full */ }
        }
      }
      // A stashed supporter link gives this brand-new reading a
      // free basic level + 10% off the full unlock (it stays locked).
      if (pendingSupporterRef.current) {
        await registerShared(record);
        await redeemPendingSupporter(record.id);
      }
      setScanning(false);
      setViewing(finalRecord);
      if (!rescanBase && finalRecord.markers.length > 0) {
        setIntroFromLibrary(false);
        setIntroScan(finalRecord);
        setView("intro");
      } else {
        setView("report");
      }
      if (finalRecord !== record) setReveal(finalRecord);
    } catch (err) {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      setReadError(
        err instanceof IrisDetectionError
          ? "We couldn't find the iris in that photo, so there's nothing solid to read. Please try again — a close, bright, straight-on photo that fills the frame with the eye works best."
          : "That photo couldn't be read — try a closer, brighter photo of the eye and try again.",
      );
      setStep("capture");
    }
  }

  function goHome() {
    setAccountPop(false);
    cancelScan();
    setView("home");
    window.scrollTo({ top: 0 });
  }

  // "How it works" opens the combined modal.
  function openHow() {
    setAccountPop(false);
    setHowOpen(true);
  }

  function startScan() {
    setRescanBase(null);
    setPairBase(null);
    setScanning(true);
    setStep("capture");
    setReadError(null);
    setViewing(null);
    setView("home");
  }

  function cancelScan() {
    setRescanBase(null);
    setPairBase(null);
    stopCamera();
    timersRef.current.forEach((t) => window.clearTimeout(t));
    setScanning(false);
    setStep("capture");
  }

  function deleteScan(id: string) {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    if (account?.user) {
      void fetch(`/api/scans/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
        () => undefined,
      );
      mirrorLocal(next);
    } else {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
    setViewing(null);
    setView(next.length ? "history" : "home");
  }

  async function submitGift(e: React.FormEvent) {
    e.preventDefault();
    setGError("");
    const email = gRecipEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGError("Please enter the recipient's email address.");
      return;
    }
    setGBusy(true);
    try {
      const res = await fetchTimeout("/api/checkout/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: email,
          recipientName: gRecipName.trim() || undefined,
          fromName: gFromName.trim() || undefined,
          message: gMessage.trim() || undefined,
          embedded: Boolean(STRIPE_PK),
        }),
      }, 25000);
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        clientSecret?: string;
        error?: string;
      };
      if (data.clientSecret) {
        setCheckoutKind("gift");
        setGiftOpen(false);
        setCheckoutSecret(data.clientSecret);
        return;
      }
      if (!res.ok || !data.url) {
        setGError(data.error ?? "Gift checkout couldn't start — try again in a moment.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setGError("Gift checkout couldn't start — check your connection and try again.");
    } finally {
      setGBusy(false);
    }
  }

  /** Redeem the stashed gift against a reading. True when applied. */
  async function redeemPendingGift(scanId: string): Promise<boolean> {
    const token = pendingGiftRef.current;
    if (!token) return false;
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, scanId }),
      });
      if (!res.ok) return false;
      pendingGiftRef.current = null;
      setPendingGift(null);
      setGiftInfo(null);
      try {
        localStorage.removeItem("eyeknow_gift");
      } catch { /* ignore */ }
      return true;
    } catch {
      return false;
    }
  }

  async function applyGiftToViewing() {
    if (!viewing || viewing.unlocked) return;
    if (viewing.accessToken) await registerShared(viewing);
    if (await redeemPendingGift(viewing.id)) {
      const updated = { ...viewing, unlocked: true };
      setViewing(updated);
      setSaved((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setUnlockNote(null);
      setReveal(updated);
    } else {
      setUnlockNote("That gift couldn't be applied — it may already have been used.");
    }
  }

  /** Redeem the stashed free supporter reading against a reading. True when applied. */
  async function redeemPendingSupporter(scanId: string): Promise<boolean> {
    const token = pendingSupporterRef.current;
    if (!token) return false;
    try {
      const res = await fetch("/api/gifts/early", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, scanId }),
      });
      if (!res.ok) return false;
      pendingSupporterRef.current = null;
      setPendingSupporter(null);
      try {
        localStorage.removeItem("eyeknow_supporter");
      } catch { /* ignore */ }
      return true;
    } catch {
      return false;
    }
  }

  async function applySupporterToViewing() {
    if (!viewing || viewing.unlocked) return;
    if (viewing.accessToken) await registerShared(viewing);
    if (await redeemPendingSupporter(viewing.id)) {
      setUnlockNote("Gift applied — this is a free basic reading, and the full unlock is 10% off.");
    } else {
      setUnlockNote("That free reading couldn't be applied — it may already have been used.");
    }
  }

  function openScan(scan: ScanRecord) {
    setViewing(scan);
    setView("report");
  }

  /** Timeline follow-up: scan the same iris again; the new reading
   *  joins this reading's chain and unlocks for $1. */
  function startRescan(base: ScanRecord) {
    startScan();
    setRescanBase(base);
    setEye(base.eye);
  }

  /** Person pair scan: photograph the person's OTHER iris; the
   *  new reading joins the same person, and one unlock covers
   *  both irises. */
  function startPairScan(rep: ScanRecord) {
    const group = groupPersons(saved).find((g) => g.personId === personIdOf(rep));
    const missing = group ? missingEye(group) : null;
    if (!missing) return;
    startScan();
    setPairBase(rep);
    setEye(missing);
  }

  /** Delete a whole person (both irises + their Timeline scans). */
  function deletePerson(person: PersonGroup) {
    const ids = new Set(person.scans.map((s) => s.id));
    const next = saved.filter((s) => !ids.has(s.id));
    setSaved(next);
    if (account?.user) {
      for (const id of ids) {
        void fetch(`/api/scans/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
          () => undefined,
        );
      }
      mirrorLocal(next);
    } else {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
    if (viewing && ids.has(viewing.id)) setViewing(null);
    setView(next.length ? "history" : "home");
  }

  /** Rename a person: the name rides on every scan of the person,
   *  locally and in both server stores. */
  function renamePerson(person: PersonGroup, name: string) {
    const trimmed = name.trim().slice(0, 60);
    const next = saved.map((s) =>
      personIdOf(s) === person.personId
        ? { ...s, personName: trimmed || undefined }
        : s,
    );
    setSaved(next);
    if (viewing && personIdOf(viewing) === person.personId) {
      setViewing({ ...viewing, personName: trimmed || undefined });
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next.slice(0, MAX_SAVED)));
    } catch {
      /* ignore */
    }
    if (account?.user) {
      for (const s of next.filter((x) => personIdOf(x) === person.personId)) {
        void fetch("/api/scans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(s),
        }).catch(() => undefined);
        void registerShared(s);
      }
    }
  }

  /** A reading's share link (token = the credential), or null. */
  function shareUrlForScan(s: ScanRecord): string | null {
    if (!s.accessToken || typeof window === "undefined") return null;
    const origin = window.location.origin.includes("vercel.app")
      ? "https://eyeknow.app"
      : window.location.origin;
    return `${origin}/?scan=${s.id}&t=${s.accessToken}`;
  }

  // Timeline chain for the open reading (oldest → newest), and the
  // $1 follow-up test: this reading follows an unlocked original.
  const viewingChain: ScanRecord[] = (() => {    if (!viewing) return [];
    const rootId = viewing.baseId ?? viewing.id;
    const list = saved
      .filter((s) => (s.baseId ?? s.id) === rootId)
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt);
    if (!list.some((s) => s.id === viewing.id)) list.push(viewing);
    return list;
  })();
  function isFollowupOfUnlocked(scan: ScanRecord | null): boolean {
    if (!scan?.baseId) return false;
    return Boolean(saved.find((s) => s.id === scan.baseId)?.unlocked);
  }

  // My readings groups scans into PEOPLE (one item per person).
  const persons = groupPersons(saved);
  const viewingGroup: PersonGroup | undefined = viewing
    ? persons.find((g) => g.personId === personIdOf(viewing))
    : undefined;
  const viewingU = viewing ? withPersonUnlock(viewing, saved) : null;

  // The open reading's share link (token = the credential). Used for
  // the report's print QR (via ReportView) and for the footer's
  // "Share this reading", which replaces "Share eyeKnow" whenever a
  // report is open (Adam's direction).
  const viewingShareUrl =
    view === "report" && viewing?.accessToken
      ? `${typeof window !== "undefined" ? (window.location.origin.includes("vercel.app") ? "https://eyeknow.app" : window.location.origin) : ""}/?scan=${viewing.id}&t=${viewing.accessToken}`
      : null;

  // Fixed top bar.
  let topCenter = "Home";
  let topRight: React.ReactNode = null;
  if (view === "report" && viewing) {
    const lockedNow = account?.configured !== false && !(viewingU ?? viewing).unlocked;
    topCenter =
      viewingGroup?.name ??
      (reportTab === "diet" && lockedNow ? "Diet 🔒" : TAB_LABELS[reportTab]);
    const next = TAB_ORDER[(TAB_ORDER.indexOf(reportTab) + 1) % TAB_ORDER.length];
    topRight = (
      <button
        type="button"
        className="tb-next"
        onClick={() => {
          setReportTab(next);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        {TAB_LABELS[next]} →
      </button>
    );
  } else if (view === "history") {
    topCenter = "My readings";
    topRight = (
      <button type="button" className="tb-next" onClick={startScan}>
        + New scan
      </button>
    );
  } else if (scanning) {
    topCenter = "New scan";
    topRight = (
      <button type="button" className="tb-next" onClick={cancelScan}>
        ✕ Cancel
      </button>
    );
  }
  // No "My readings" button in the top bar (Adam, 2026-11-04) —
  // readings live in the ☰ menu and the bottom bar.

  return (
    <div className={`app${view === "home" && !scanning && !viewing ? " home-view" : ""}`}>
      <ReferralCapture />
      {view === "home" && !scanning && !viewing && (
        <HomeScene onCreator={() => setCreatorOpen(true)} reducedMotion={reducedMotion} />
      )}
      <header className="topbar2 no-print">
        <Galaxy variant="nav" />
        <div className="galaxy-scrim" aria-hidden="true" />
        <div className="tb-side">
          <button
            type="button"
            className="brand tb-brand"
            onClick={goHome}
            aria-label="eyeKnow home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <LogoEye className="brand-logo" />
            <span>eye<b className="brand-know">Know</b></span>
          </button>
        </div>
        <div className="tb-center" aria-live="polite">{topCenter}</div>
        <div className="tb-side tb-right">
          {topRight}
          <button
            type="button"
            className="tb-menu-btn"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span aria-hidden="true">☰</span>
            <span className="tb-menu-word">Menu</span>
          </button>
        </div>
      </header>
      <GalaxyMenu
        open={menuOpen}
        onClose={closeMenu}
        savedCount={saved.length}
        accountEmail={account?.user?.email ?? null}
        isAdmin={Boolean(account?.admin)}
        onHome={goHome}
        onScan={startScan}
        onHistory={() => { cancelScan(); setView("history"); }}
        onHow={openHow}
        onSignIn={() => openAuth("login")}
        onCreateAccount={() => openAuth("register")}
        onSignOut={() => void signOut()}
      />
      <BottomNav
        view={view}
        savedCount={saved.length}
        popOpen={accountPop}
        accountEmail={account?.user?.email ?? null}
        isAdmin={Boolean(account?.admin)}
        canInstall={Boolean(installEvt)}
        onHome={goHome}
        onHow={openHow}
        onHistory={() => { setAccountPop(false); cancelScan(); setView("history"); }}
        onScan={() => { setAccountPop(false); startScan(); }}
        onTogglePop={() => setAccountPop((v) => !v)}
        onSignIn={() => openAuth("login")}
        onCreateAccount={() => openAuth("register")}
        onSignOut={() => { setAccountPop(false); void signOut(); }}
        onInstall={doInstall}
        unlockMode={finaleUnlock}
        onUnlockPress={() => setUnlockAsk((n) => n + 1)}
      />
      <InstallToast
        canInstall={Boolean(installEvt)}
        installed={justInstalled}
        standalone={standalone}
        onInstall={doInstall}
      />
      <HowModal
        open={howOpen}
        onClose={() => setHowOpen(false)}
        onExample={() => { setHowOpen(false); setExampleOpen(true); }}
      />
      {creatorOpen && <CreatorBooksModal onClose={() => setCreatorOpen(false)} />}

      <main>
        {pendingGift && view === "home" && (
          <div className="gift-banner no-print">
            <span>
              🎁{" "}
              {giftInfo?.fromName ? (
                <>
                  <b>{giftInfo.fromName}</b> gifted you a full eyeKnow reading.
                </>
              ) : (
                <>You've been gifted a full eyeKnow reading.</>
              )}
              {giftInfo?.message ? <> “{giftInfo.message}”</> : ""} Start your scan and the
              complete report unlocks free.
            </span>
            <button type="button" className="btn" onClick={startScan}>
              Start my scan
            </button>
          </div>
        )}
        {pendingSupporter && view === "home" && (
          <div className="gift-banner no-print">
            <span>
              🎁 You&apos;ve been gifted a free basic eyeKnow reading. Start your scan,
              then unlock the full report for 10% off.
            </span>
            <button type="button" className="btn" onClick={startScan}>
              Start my scan
            </button>
          </div>
        )}
        {linkNote && view !== "report" && (
          <p className="warn" style={{ marginTop: 14 }}>
            {linkNote}{" "}
            <button type="button" className="btn textlike" onClick={() => setLinkNote(null)}>
              Dismiss
            </button>
          </p>
        )}
        {view === "intro" && introScan ? (
          <RevealSlides
            scan={introScan}
            busy={unlockBusy}
            onExit={
              introFromLibrary
                ? () => {
                    setIntroScan(null);
                    setIntroFromLibrary(false);
                    setView("history");
                  }
                : undefined
            }
            onDone={() => {
              setIntroScan(null);
              setIntroFromLibrary(false);
              setView("report");
            }}
            onUnlockBasic={() => void unlockViewing(false, "basic")}
            onUnlockFull={() => void unlockViewing()}
            onFinaleChange={setFinaleUnlock}
            unlockSignal={unlockAsk}
            personName={viewingGroup?.name ?? null}
            onNamePerson={
              viewingGroup ? (name) => renamePerson(viewingGroup, name) : undefined
            }
          />
        ) : view === "report" && viewing ? (
          <>
            {sharedLink &&
              sharedLink.id === viewing.id &&
              !saved.some((s) => s.id === viewing.id) && (
                <div className="shared-bar no-print">
                  <span>
                    📄 You're viewing a shared reading
                    {viewing.unlocked ? " — it's unlocked in full" : ""}.{" "}
                    {account?.user
                      ? "Save it into your account to keep it with your readings."
                      : "You can buy the full version right from this page — and save it into an account after."}
                  </span>
                  <button type="button" className="btn" onClick={() => void saveSharedToAccount()}>
                    {account?.user ? "Save to my account" : "Save to an account"}
                  </button>
                </div>
              )}
            {pendingGift && !viewing.unlocked && saved.some((s) => s.id === viewing.id) && (
              <div className="shared-bar gift-bar no-print">
                <span>
                  🎁 You have an unused gift reading
                  {giftInfo?.fromName ? ` from ${giftInfo.fromName}` : ""}.
                </span>
                <button type="button" className="btn" onClick={() => void applyGiftToViewing()}>
                  Apply your gift to this reading
                </button>
              </div>
            )}
            {pendingSupporter && !viewing.unlocked && saved.some((s) => s.id === viewing.id) && (
              <div className="shared-bar gift-bar no-print">
                <span>
                  🎁 You have an unused gifted basic reading — 10% off the full unlock.
                </span>
                <button type="button" className="btn" onClick={() => void applySupporterToViewing()}>
                  Apply your gifted basic reading
                </button>
              </div>
            )}
            {supporterScanLinks && supporterScanLinks.length > 0 && viewing.unlocked && (
              <ReportSupporterPanel links={supporterScanLinks} copied={supporterCopied} onCopy={(url) => { void navigator.clipboard?.writeText(url).then(() => setSupporterCopied(url)).catch(() => undefined); }} />
            )}
            <ReportView
              scan={viewingU ?? viewing}
              onBack={() => setView(saved.length ? "history" : "home")}
              onDelete={saved.some((s) => s.id === viewing.id) ? deleteScan : undefined}
              locked={account?.configured !== false && !(viewingU ?? viewing).unlocked}
              personName={viewingGroup?.name ?? null}
              onRenamePerson={
                viewingGroup ? (name) => renamePerson(viewingGroup, name) : undefined
              }
              personReps={
                viewingGroup
                  ? [viewingGroup.right, viewingGroup.left]
                      .filter((s): s is ScanRecord => Boolean(s))
                      .map((s) => withPersonUnlock(s, saved))
                  : undefined
              }
              otherEyeMissing={viewingGroup ? missingEye(viewingGroup) : null}
              onScanOtherEye={viewingGroup ? () => startPairScan(viewing) : undefined}
              onUnlock={() => void unlockViewing()}
              onUnlockBasic={() => void unlockViewing(false, "basic")}
              basic={Boolean(
                viewing.basic ||
                  saved.some(
                    (s) =>
                      s.basic &&
                      (s.personId ?? s.id) === (viewing.personId ?? viewing.id),
                  ),
              )}
              unlockBusy={unlockBusy}
              unlockNote={unlockNote}
              onExample={() => setExampleOpen(true)}
              onGift={() => { setGError(""); setGiftOpen(true); }}
              tab={reportTab}
              onTabChange={setReportTab}
              chain={viewingChain}
              followupPrice={isFollowupOfUnlocked(viewing)}
              onRescan={() => startRescan(viewing)}
              onOpenScan={openScan}
              shareUrl={viewingShareUrl}
            />
          </>
        ) : view === "history" ? (
          <section className="panel">
            <h1>My readings</h1>
            {saved.length === 0 ? (
              <p className="muted">
                No readings yet. Take your first iris scan — it takes about a minute.
              </p>
            ) : (
              <>
                <ReadingsList
                  persons={persons}
                  shareUrlFor={shareUrlForScan}
                  onUnlock={unlockPersonFromLibrary}
                  onOpen={(scan, tab) => {
                    if (tab) tabIntentRef.current = tab;
                    const s = withPersonUnlock(scan, saved);
                    // Adam, 2026-11-06: an unpaid reading opens its intro, not the report.
                    const personBasic = Boolean(
                      s.basic ||
                        saved.some(
                          (x) =>
                            x.basic &&
                            (x.personId ?? x.id) === (s.personId ?? s.id),
                        ),
                    );
                    if (!s.unlocked && !personBasic) {
                      setViewing(s);
                      setIntroFromLibrary(true);
                      setIntroScan(s);
                      setView("intro");
                    } else {
                      openScan(s);
                    }
                  }}
                  onPrint={(scan) => {
                    openScan(withPersonUnlock(scan, saved));
                    pendingPrintRef.current = true;
                  }}
                  onDeletePerson={deletePerson}
                />
              </>
            )}
            {supporterLinks !== null && supporterLinks.length > 0 && (
              <AccountSupporterPanel links={supporterLinks} copied={supporterCopied} onCopy={(url) => { void navigator.clipboard?.writeText(url).then(() => setSupporterCopied(url)).catch(() => undefined); }} />
            )}
            <button type="button" className="btn big" onClick={startScan}>
              + New scan
            </button>
          </section>
        ) : scanning ? (
          <section className="panel scan-panel">
            <div className="steps-row" aria-hidden="true">
              <span className={`step-chip${step === "capture" ? " on" : ""}`}>1. Photo</span>
              <span className={`step-chip${step === "reading" ? " on" : ""}`}>2. Auto-read</span>
              <span className="step-chip">3. Report</span>
            </div>

            {step === "capture" && (
              <div>
                <h1>Photograph the iris</h1>
                <p className="muted">
                  Bright, even light works best — face a window if you can. Hold the phone close
                  enough that the eye fills the circle, and keep the eye wide open and looking
                  straight at the camera. The app reads the iris automatically from the photo —
                  dark irises get an automatic contrast boost so their fibers show.
                </p>
                <CaptureTips />
                {rescanBase ? (
                  <p className="followup-note">
                    ↳ <b>Follow-up scan.</b> Photograph the <b>{rescanBase.eye} eye</b> again —
                    the same eye as your{" "}
                    {new Date(rescanBase.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    reading — so the Timeline can compare them.
                  </p>
                ) : pairBase ? (
                  <p className="followup-note">
                    👁 <b>Second iris{pairBase.personName ? ` for ${pairBase.personName}` : ""}.</b>{" "}
                    Photograph the <b>{eye} eye</b> — the other iris of this reading. Both
                    irises belong to one person.
                  </p>
                ) : (
                <div className="eye-picker" role="radiogroup" aria-label="Which eye">
                  {(["right", "left"] as EyeSide[]).map((e) => (
                    <button
                      key={e}
                      type="button"
                      role="radio"
                      aria-checked={eye === e}
                      className={eye === e ? "chip on" : "chip"}
                      onClick={() => setEye(e)}
                    >
                      {e === "right" ? "Right eye" : "Left eye"}
                    </button>
                  ))}
                </div>
                )}

                {camOn ? (
                  <div className="camera-box">
                    <video ref={videoRef} playsInline muted className={camMode === "user" ? "mirrored" : ""} />
                    <div className="camera-guide" aria-hidden="true" />
                    <div className="camera-actions">
                      <button type="button" className="btn big" onClick={snapPhoto}>
                        📷 Take photo
                      </button>
                      <button
                        type="button"
                        className="btn ghost light"
                        onClick={() => {
                          const next = camMode === "user" ? "environment" : "user";
                          setCamMode(next);
                          void startCamera(next);
                        }}
                      >
                        Flip camera
                      </button>
                      <button type="button" className="btn ghost light" onClick={stopCamera}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="capture-actions">
                    <button type="button" className="btn big" onClick={() => void startCamera(camMode)}>
                      Open camera
                    </button>
                    <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
                      Upload a photo instead
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => onUpload(e.target.files?.[0])}
                    />
                  </div>
                )}
                {camError && <p className="warn">{camError}</p>}
                {readError && <p className="warn">{readError}</p>}
                <button type="button" className="btn textlike" onClick={cancelScan}>
                  ← Back
                </button>
              </div>
            )}

            {step === "reading" && (
              <div className="reading-wrap">
                <h1>What do eyeKnow?</h1>
                <div className="reading-visual" aria-hidden="true">
                  {readImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={readImage} alt="" className={READ_STAGES[readStage].visual === 3 ? "enhancing" : ""} />
                  )}
                  <svg className="reading-base-rings" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="17" />
                    <circle cx="50" cy="50" r="31" />
                    <circle cx="50" cy="50" r="45" />
                  </svg>
                  <StageOverlay key={readStage} stage={READ_STAGES[readStage].visual} />
                </div>
                {/* One step at a time, in a badge (Adam, 2026-11-05). */}
                <div
                  className={`reading-badge rstep ${foundCount !== null && readStage >= READ_STAGES.length - 1 ? "done" : "active"}`}
                  key={readStage}
                  aria-live="polite"
                >
                  <span className="rstep-icon" aria-hidden="true">
                    {foundCount !== null && readStage >= READ_STAGES.length - 1 ? "✓" : ""}
                  </span>
                  <span>
                    {foundCount !== null && readStage >= READ_STAGES.length - 1
                      ? `Found ${foundCount} sign${foundCount === 1 ? "" : "s"} — opening your report…`
                      : READ_STAGES[readStage].label}
                  </span>
                </div>
                <div className="reading-progress" aria-hidden="true">
                  <i style={{ width: `${((readStage + 1) / READ_STAGES.length) * 100}%` }} />
                </div>
                <p className="muted" style={{ textAlign: "center" }}>
                  Measuring against the traditional chart — a few seconds.
                </p>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="hero">
              <Galaxy variant="hero" />
              <div className="hero-scrim" aria-hidden="true" />
              <div className="hero-grid">
                <div className="hero-text">
                  <p className="eyebrow">Traditional iridology, from a photo</p>
                  <h1>Reveal secrets to health through your eyes.</h1>
                </div>
                <ScanDemo
                  StageOverlay={StageOverlay}
                  personalScan={
                    saved.length
                      ? [...saved].sort((a, b) => a.createdAt - b.createdAt)[0]
                      : null
                  }
                />
                <p className="lede">
                  eyeKnow guides you through photographing your iris, then reads it automatically
                  — locating the iris, mapping it onto the classic iridology chart, and measuring
                  the traditional signs for a clear report. Right on your phone, in about a minute.
                </p>
                {!standalone && !justInstalled && (
                  <div className="hero-actions home-scan-actions">
                    <button type="button" className="btn big home-scan-button" onClick={startScan}>
                      📸 Start a new scan
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section className="panel" id="how-it-works">
              <h2>How it works</h2>
              <div className="how-steps">
                <div className="how-card">
                  <div className="how-visual">
                    <div className="snap-phone" aria-hidden="true">
                      <div className="snap-screen">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={HERO_EYE_SRCS[heroEyeIdx]} alt="" />
                        <span className="snap-ring" />
                        <span className="snap-flash" />
                        <span className="snap-notch" />
                        <span className="snap-shutter" />
                      </div>
                    </div>
                  </div>
                  <h3>1. Photograph</h3>
                  <p>
                    Use your camera (or upload a close-up) — a guide helps you fill the frame
                    with one eye, lit evenly.
                  </p>
                </div>
                <div className="how-card">
                  <div className="how-visual">
                    <MiniReadCycle StageOverlay={StageOverlay} />
                  </div>
                  <h3>2. Auto-read</h3>
                  <p>
                    The app finds your pupil and iris edge, unrolls the iris onto the
                    traditional chart, and measures the classic signs — dark patches, pigment,
                    furrows, rings, cloudiness, fiber texture. Dark irises get an automatic
                    contrast boost first, so their fibers read properly.
                  </p>
                </div>
                <div className="how-card">
                  <div className="how-visual">
                    <ReportPreviewCycle />
                  </div>
                  <h3>3. Read your report</h3>
                  <p>
                    Your report explains, zone by zone, what the traditional chart associates
                    with each sign found, how clearly each was defined, plus your constitution
                    type — across six views: Overview, Body Map, Findings, Diet, Timeline,
                    and Notes. Save it, print it, or compare with your next scan.
                  </p>
                </div>
                <div className="how-card">
                  <div className="how-visual">
                    <TimelinePreviewCycle />
                  </div>
                  <h3>4. Build your timeline</h3>
                  <p>
                    Follow your report's recommendations, then rescan the same iris — once
                    your reading is unlocked, follow-up scans are just $1. Each new scan is
                    compared with the last automatically, so you can observe the traditional
                    signs change as you follow the recommendations.
                  </p>
                </div>
              </div>
              <div className="how-example">
                <button type="button" className="btn big" onClick={() => setExampleOpen(true)}>
                  📖 See an example full reading
                </button>
              </div>
            </section>

            <section className="panel">
              <h2>What the report covers</h2>
              <CoverCards />
            </section>

            <section className="panel gift-panel">
              <h2>🎁 Gift a reading</h2>
              <p>
                Buy a full reading in advance and send it as a gift. They get an email with a
                personal link, take their own eye scan, and the complete report — every sign,
                the full body map, and personalized diet recommendations — unlocks free.
              </p>
              <button type="button" className="btn big" onClick={() => { setGError(""); setGiftOpen(true); }}>
                🎁 Gift a reading — <AffPrice />
              </button>
            </section>
            <JoinTeam />
            <PalmPromo />
            <Reviews />
            <ScrollFx />
          </>
        )}
      </main>

      {exampleOpen && (
        <div className="example-overlay no-print" role="dialog" aria-modal="true" aria-label="Example full reading">
          <div className={`example-bar${exampleBarShown && !exampleAnimating ? " shown" : ""}`}>
            <p>
              <b>📖 Example full reading</b>
              <span className="example-bar-sub"> — this is what an unlocked reading looks like. Yours is built from your own iris.</span>
            </p>
            <button type="button" className="btn" onClick={() => setExampleOpen(false)}>
              Close ✕
            </button>
          </div>
          <div
            className="example-scroll"
            onScroll={(e) => {
              if (exampleAnimating || exampleBarShown) return;
              const el = e.currentTarget;
              const max = el.scrollHeight - el.clientHeight;
              if (max > 0 && el.scrollTop / max >= 0.5) setExampleBarShown(true);
            }}
          >
            {exampleAnimating ? (
              <div className="panel reading-wrap example-reading">
                <h1>What do eyeKnow?</h1>
                <div className="reading-visual" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={EXAMPLE_SCAN.image}
                    alt=""
                    className={READ_STAGES[exampleStage].visual === 3 ? "enhancing" : ""}
                  />
                  <svg className="reading-base-rings" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="17" />
                    <circle cx="50" cy="50" r="31" />
                    <circle cx="50" cy="50" r="45" />
                  </svg>
                  <StageOverlay key={exampleStage} stage={READ_STAGES[exampleStage].visual} />
                </div>
                <div
                  className={`reading-badge rstep ${exampleStage >= READ_STAGES.length - 1 ? "done" : "active"}`}
                  key={exampleStage}
                  aria-live="polite"
                >
                  <span className="rstep-icon" aria-hidden="true">
                    {exampleStage >= READ_STAGES.length - 1 ? "✓" : ""}
                  </span>
                  <span>
                    {exampleStage >= READ_STAGES.length - 1
                      ? `Found ${EXAMPLE_SCAN.markers.length} signs — opening your report…`
                      : READ_STAGES[exampleStage].label}
                  </span>
                </div>
                <div className="reading-progress" aria-hidden="true">
                  <i style={{ width: `${((exampleStage + 1) / READ_STAGES.length) * 100}%` }} />
                </div>
                <p className="muted" style={{ textAlign: "center" }}>
                  Measuring against the traditional chart — a few seconds.{" "}
                  <button
                    type="button"
                    className="btn textlike"
                    onClick={() => setExampleAnimating(false)}
                  >
                    Skip →
                  </button>
                </p>
              </div>
            ) : (
              <ReportView
                scan={EXAMPLE_CHAIN[exampleIdx] ?? EXAMPLE_SCAN}
                example
                chain={EXAMPLE_CHAIN}
                onOpenScan={(s) => {
                  const i = EXAMPLE_CHAIN.findIndex((x) => x.id === s.id);
                  if (i >= 0) setExampleIdx(i);
                }}
              />
            )}
          </div>
        </div>
      )}

      {reveal && (
        <PurchaseReveal
          scan={reveal}
          stage={revealStage}
          StageOverlay={StageOverlay}
          onSkip={() => setReveal(null)}
        />
      )}

      <GiftModals
        giftOpen={giftOpen}
        onCloseGift={() => setGiftOpen(false)}
        onSubmitGift={submitGift}
        gRecipName={gRecipName}
        setGRecipName={setGRecipName}
        gRecipEmail={gRecipEmail}
        setGRecipEmail={setGRecipEmail}
        gFromName={gFromName}
        setGFromName={setGFromName}
        gMessage={gMessage}
        setGMessage={setGMessage}
        gError={gError}
        gBusy={gBusy}
        giftDone={giftDone}
        onCloseDone={() => setGiftDone(null)}
        giftCopied={giftCopied}
        onCopyLink={() => {
          if (giftDone) {
            void navigator.clipboard?.writeText(giftDone.url).then(() => setGiftCopied(true)).catch(() => undefined);
          }
        }}
      />

      {checkoutSecret && (
        <CheckoutModal
          kind={checkoutKind}
          tier={unlockTier}
          followup={Boolean(viewing && isFollowupOfUnlocked(viewing))}
          stalled={checkoutStalled}
          mountRef={checkoutMountRef}
          scanId={viewing?.id}
          accessToken={viewing?.accessToken}
          onClose={() => setCheckoutSecret(null)}
          onHosted={() => {
            setCheckoutSecret(null);
            void unlockViewing(true, unlockTier);
          }}
        />
      )}

      {authOpen && (
        <div
          className="modal-backdrop no-print"
          role="dialog"
          aria-modal="true"
          aria-label={authMode === "register" ? "Create your account" : "Sign in"}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAuthOpen(false);
          }}
        >
          <div className="modal-card">
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={() => setAuthOpen(false)}
            >
              ×
            </button>
            <p className="report-brand">eyeKnow account</p>
            <h2 className="modal-title">
              {authMode === "register" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="muted">
              Your readings live in your account — open them on any device, and anything you
              unlock stays yours here.
            </p>
            {authNote && <p className="auth-note">{authNote}</p>}
            {account?.googleConfigured && (
              <>
                <a
                  className="btn google-btn"
                  href={`/api/auth/google${viewing && !viewing.unlocked ? `?scan=${encodeURIComponent(viewing.id)}` : ""}`}
                >
                  <span className="google-g" aria-hidden="true">G</span> Continue with Google
                </a>
                <div className="auth-divider" aria-hidden="true">
                  <span>or with email</span>
                </div>
              </>
            )}
            <form className="auth-form" onSubmit={(e) => void submitAuth(e)}>
              <label>
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={authMode === "register" ? 8 : 1}
                  autoComplete={authMode === "register" ? "new-password" : "current-password"}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder={authMode === "register" ? "At least 8 characters" : "Your password"}
                />
              </label>
              {authError && <p className="auth-error">{authError}</p>}
              <button type="submit" className="btn big" disabled={authBusy}>
                {authBusy
                  ? "One moment…"
                  : authMode === "register"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
            <p className="muted" style={{ marginBottom: 0 }}>
              {authMode === "register" ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="textlink"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  New to eyeKnow?{" "}
                  <button
                    type="button"
                    className="textlink"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                    }}
                  >
                    Create an account
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <footer
        className={`footer no-print${view === "home" && !scanning && !viewing ? " footer-on-water" : ""}`}
      >
        {view === "home" && !scanning && !viewing ? (
          reducedMotion ? (
          <div className="water-row">
            <ShareButtons
              variant="modal"
              iconOnly
              url="https://eyeknow.app/"
              title="eyeKnow — Traditional Iridology Readings"
              text="eyeKnow — a traditional iridology reading from a photo of your eye:"
              label="Share eyeKnow"
            />
          </div>
          ) : null
        ) : viewingShareUrl ? (
          <>
            <ShareButtons
              variant="modal"
              url={viewingShareUrl}
              title="My eyeKnow iridology reading"
              text="My traditional iridology reading from eyeKnow — open it here:"
              label="Share this reading"
            />
            <span>eyeKnow — traditional iridology readings for interest and self-reflection. Not medical advice.</span>
          </>
        ) : (
          <ShareButtons
            variant="modal"
            url="https://eyeknow.app/"
            title="eyeKnow — Traditional Iridology Readings"
            text="eyeKnow — a traditional iridology reading from a photo of your eye:"
            label="Share eyeKnow"
          />
        )}
      </footer>
    </div>
  );
}

/** The per-step detection animation, shared by the real reading
 *  screen and the homepage hero demo. */
