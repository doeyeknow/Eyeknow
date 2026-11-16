import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isValidRefValue } from "@/lib/affiliates-client";
import { stampApk } from "@/lib/apkStamp";

export const dynamic = "force-dynamic";

/** Serve the eyeKnow native APK, stamped with the referral
 *  code when the download comes through a referral link.
 *
 *  URL pattern (the only surface — no page UI):
 *    GET /api/app/download?ref=<code>
 *
 *  The code is validated with the same rule and the same
 *  normalization (trim + lowercase) as ReferralCapture. A
 *  valid code is embedded into the APK Signing Block (see
 *  lib/apkStamp.ts); the app reads it on its first launch
 *  and the referral is captured exactly as if the link had
 *  opened in the app. An absent or invalid code serves the
 *  byte-identical unstamped APK. A stamping failure also
 *  serves the pristine bytes — a download must never fail
 *  because the stamp could not be applied.
 *
 *  STANDING RULE: the bundled APK (app-binary/eyeknow.apk)
 *  MUST be refreshed on every native release — this endpoint
 *  serves whatever file is bundled, so a stale bundle ships
 *  an old app. Bundle the PRISTINE build output (never an
 *  already-stamped file). The bundle is wired into the
 *  function via outputFileTracingIncludes in next.config.mjs,
 *  following the book-download precedent.
 */
export async function GET(req: NextRequest) {
  const apkPath = path.join(process.cwd(), "app-binary", "eyeknow.apk");
  let apk: Buffer;
  try {
    apk = await fs.readFile(apkPath);
  } catch {
    return NextResponse.json({ error: "download unavailable" }, { status: 503 });
  }
  const raw = req.nextUrl.searchParams.get("ref") ?? "";
  const code = raw.trim().toLowerCase();
  let body: Buffer = apk;
  if (isValidRefValue(code)) {
    try {
      body = stampApk(apk, code);
    } catch {
      // Stamping failed: serve the pristine bytes.
      body = apk;
    }
  }
  // Uint8Array view: Buffer is not assignable to BodyInit here.
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="eyeknow.apk"`,
      "Content-Length": String(body.length),
      // Stamped per code: never let a shared cache serve one
      // visitor's stamped APK to another.
      "Cache-Control": "no-store",
    },
  });
}
