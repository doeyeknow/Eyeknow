import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { getSharedScan, registerSharedScan } from "@/lib/shared";
import { applyGiftUnlockIfAny } from "@/lib/gifts";
import type { ScanRecord } from "@/lib/chart";

export const dynamic = "force-dynamic";

/** Register (or refresh) the shared copy of a reading. The access
 *  token is the credential — it lives in the printed report's QR
 *  link — so no account is needed, by design (Adam's direction). */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as {
    scan?: ScanRecord;
    accessToken?: string;
  } | null;
  const scan = body?.scan;
  const accessToken = body?.accessToken ?? "";
  if (
    !scan ||
    typeof scan.id !== "string" ||
    typeof scan.createdAt !== "number" ||
    !Array.isArray(scan.markers) ||
    accessToken.length < 16
  ) {
    return NextResponse.json({ error: "invalid scan" }, { status: 400 });
  }
  // A client payload must never carry an unlock into the store.
  const clean = { ...scan, unlocked: false, basic: false };
  await registerSharedScan(clean, accessToken);
  await applyGiftUnlockIfAny(scan.id);
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Fetch a shared reading by id + access token (the QR link). */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const scan = await getSharedScan(id, token);
  if (!scan) return NextResponse.json({ error: "reading not found" }, { status: 404 });
  return NextResponse.json({ scan });
}
