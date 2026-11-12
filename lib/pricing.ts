// Server-side unlock pricing. A follow-up scan in a Timeline chain
// (its record carries baseId, the chain's original reading) unlocks
// for $1 when — and only when — the base reading is unlocked in the
// server's own tables. The client never sets the price; every
// checkout path recomputes it here so the discount can't be faked.

import { query } from "./db";
import { UNLOCK_PRICE_CENTS } from "./stripe";

export const FOLLOWUP_PRICE_CENTS = 100;

/** Apply a percent discount to a price, rounded to the cent.
 *  10% off $19.99 → $17.99; 10% off $9.99 → $8.99. Follow-ups ($1)
 *  are never discounted — the discount is a full-reading offer. */
export function applyUnlockDiscount(priceCents: number, discountPct: number): number {
  if (!discountPct || discountPct <= 0 || discountPct >= 100) return priceCents;
  return Math.round((priceCents * (100 - discountPct)) / 100);
}

function baseIdOf(data: unknown): string | null {
  try {
    const obj = (typeof data === "string" ? JSON.parse(data) : data) as {
      baseId?: unknown;
    } | null;
    return typeof obj?.baseId === "string" && obj.baseId ? obj.baseId : null;
  } catch {
    return null;
  }
}

async function baseUnlocked(baseId: string, userId?: string): Promise<boolean> {
  const shared = await query<{ unlocked: boolean }>(
    `SELECT unlocked FROM iris_shared_scans WHERE scan_id = $1`,
    [baseId],
  );
  if (shared.length && shared[0].unlocked) return true;
  if (userId) {
    const own = await query<{ unlocked: boolean }>(
      `SELECT unlocked FROM iris_scans WHERE user_id = $1 AND scan_id = $2`,
      [userId, baseId],
    );
    if (own.length && own[0].unlocked) return true;
  } else {
    const any = await query<{ unlocked: boolean }>(
      `SELECT unlocked FROM iris_scans WHERE scan_id = $1 AND unlocked = true LIMIT 1`,
      [baseId],
    );
    if (any.length) return true;
  }
  return false;
}

/** Price to unlock an account reading. */
export async function accountUnlockPriceCents(
  userId: string,
  scanId: string,
): Promise<number> {
  const rows = await query<{ data: unknown }>(
    `SELECT data FROM iris_scans WHERE user_id = $1 AND scan_id = $2`,
    [userId, scanId],
  );
  if (!rows.length) return UNLOCK_PRICE_CENTS;
  const baseId = baseIdOf(rows[0].data);
  if (!baseId) return UNLOCK_PRICE_CENTS;
  return (await baseUnlocked(baseId, userId))
    ? FOLLOWUP_PRICE_CENTS
    : UNLOCK_PRICE_CENTS;
}

/** Price to unlock a shared (guest) reading; pass its stored record. */
export async function sharedUnlockPriceCents(scanRecord: unknown): Promise<number> {
  const baseId = baseIdOf(scanRecord);
  if (!baseId) return UNLOCK_PRICE_CENTS;
  return (await baseUnlocked(baseId))
    ? FOLLOWUP_PRICE_CENTS
    : UNLOCK_PRICE_CENTS;
}
