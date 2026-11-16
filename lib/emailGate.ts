// Email gate + offer-email capture: pure helpers shared by the
// browser and the server. This module imports NOTHING — it must
// stay safe to import from client components (no pg, no web-push).
//
// The email is required before the FIRST scan (Adam, 2026-11-15
// 23:46): the reading and the link back to it come to the email,
// and the email is used only for that. Once stored, never ask again.

/** localStorage key for the email given at the first-scan gate. */
export const OFFER_EMAIL_STORAGE_KEY = "eyeknow_offer_email";

/** localStorage key for the device's saved readings. Must match
 *  LS_KEY in components/IrisApp.tsx — the gate reads the same list
 *  to tell a returning guest (prior scans) from a first-timer. */
export const LOCAL_SCANS_KEY = "irisread_scans_v1";

/** The account email format (same pattern the register route
 *  enforces server-side). Trims before testing. */
export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Should the first-scan gate show? Never for a signed-in account
 *  (its email is on file), never once a valid email is stored
 *  locally, never when the device already holds scans. */
export function shouldShowGate(args: {
  signedIn: boolean;
  storedEmail: string | null;
  localScanCount: number;
}): boolean {
  if (args.signedIn) return false;
  if (args.storedEmail && validEmail(args.storedEmail)) return false;
  if (args.localScanCount > 0) return false;
  return true;
}

/** How many saved readings a raw localStorage value holds. Any
 *  unreadable value counts as zero (a corrupt list must not hide
 *  the gate from a first-timer, nor show it to a returner — the
 *  stored-email check above decides those). */
export function countLocalScans(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
