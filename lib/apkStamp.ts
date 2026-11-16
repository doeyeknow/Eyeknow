// Referral stamp for the eyeKnow native APK download.
//
// When someone downloads the app through a referral link, the
// download endpoint stamps the referral code into the APK
// Signing Block as an ID-value pair with an ID no verifier
// knows. The app (v1.5+) reads its own APK file on its first
// plain launch and loads the home page with ?ref= once, so the
// page's existing ReferralCapture stores the referral exactly
// as if the link had opened in the app.
//
// Why the signing block is safe to extend: the APK Signature
// Scheme v2 spec protects sections 1 (ZIP entry contents), 3
// (central directory) and 4 (EOCD) — the signing block itself
// (section 2) is outside the signed digest — and "ID-value
// pairs with unknown IDs should be ignored when interpreting
// the block." Stamping inserts one pair, updates the block's
// two size fields and the EOCD's central-directory offset, and
// moves nothing else: apksigner still verifies v2 and v3 on
// the stamped file (proven empirically on the real APK). The
// v3 scheme uses the same block and digest sections, so the
// same argument covers it.
//
// The stamp format — ONE format, shared with the app's Java
// reader (ApkStamp.java in the native project), pinned by
// shared test vectors run both ways:
//
//   pair ID    0x45594b4e ('EYKN' as big-endian ASCII)
//   pair value ASCII "EYEKNOW-REF:" + <code>
//   code       isValidRefValue from ./affiliates-client
//              (/^[a-z0-9-]{3,30}$/ + at least one [a-z0-9])
//
// stampApk assumes UNSTAMPED input: the endpoint always stamps
// the pristine bundled APK. (A stamped APK stamped again would
// still verify, and the app's reader takes the FIRST valid
// stamp — the original — so the case is safe but pointless.)
// No dependencies; Buffer only.

import { isValidRefValue } from "./affiliates-client";

/** Signing-block pair ID for the referral stamp. */
export const STAMP_ID = 0x45594b4e;

/** Value prefix; the code follows it directly. */
export const VALUE_MAGIC = "EYEKNOW-REF:";

const EOCD_SIG = 0x06054b50;
const BLOCK_MAGIC = Buffer.from("APK Sig Block 42", "ascii");
const EOCD_LEN = 22;
const MAX_COMMENT = 0xffff;

/**
 * A copy of `apk` with the referral stamp inserted into its
 * signing block. Throws when the code is invalid or the APK
 * cannot be parsed safely (no signing block, ZIP64,
 * malformed structures) — the caller serves the pristine
 * bytes instead. The input buffer is never mutated.
 */
export function stampApk(apk: Buffer, code: string): Buffer {
  const normalized = code.trim().toLowerCase();
  if (!isValidRefValue(normalized)) {
    throw new Error("invalid referral code");
  }
  const eocd = findEocd(apk);
  if (eocd < 0) throw new Error("no EOCD record");
  const cdSize = apk.readUInt32LE(eocd + 12);
  const cdOffset = apk.readUInt32LE(eocd + 16);
  if (cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error("ZIP64 APK not supported");
  }
  if (cdOffset < 24 || cdOffset > eocd) throw new Error("bad central directory offset");
  const footer = cdOffset - 24;
  const size2 = readU64(apk, footer);
  if (!apk.subarray(footer + 8, footer + 24).equals(BLOCK_MAGIC)) {
    throw new Error("no APK signing block");
  }
  const blockStart = cdOffset - 8 - size2;
  if (blockStart < 0 || blockStart > footer) throw new Error("bad signing block size");
  const size1 = readU64(apk, blockStart);
  if (size1 !== size2) throw new Error("signing block size mismatch");

  const value = Buffer.from(VALUE_MAGIC + normalized, "ascii");
  const pairLen = 4 + value.length;
  const pair = Buffer.alloc(8 + pairLen);
  writeU64(pair, 0, pairLen);
  pair.writeUInt32LE(STAMP_ID, 8);
  value.copy(pair, 12);
  const newSize = size2 + pair.length;

  const out = Buffer.alloc(apk.length + pair.length);
  let o = 0;
  apk.subarray(0, blockStart).copy(out, o);
  o += blockStart;
  writeU64(out, o, newSize);
  o += 8;
  apk.subarray(blockStart + 8, footer).copy(out, o);
  o += footer - (blockStart + 8);
  pair.copy(out, o);
  o += pair.length;
  writeU64(out, o, newSize);
  o += 8;
  BLOCK_MAGIC.copy(out, o);
  o += 16;
  apk.subarray(cdOffset, eocd).copy(out, o);
  o += eocd - cdOffset;
  apk.subarray(eocd).copy(out, o);
  out.writeUInt32LE(cdOffset + pair.length, o + 16);
  return out;
}

/**
 * The referral code stamped into an APK's bytes, or null when
 * the APK carries no valid stamp or cannot be parsed safely.
 * Exported for the shared-vector tests (and symmetry with the
 * app's reader): the endpoint itself only stamps, never reads.
 * The first valid stamp wins, matching the app's reader.
 */
export function readStamp(apk: Buffer): string | null {
  try {
    return readStampChecked(apk);
  } catch {
    return null;
  }
}

function readStampChecked(apk: Buffer): string | null {
  const eocd = findEocd(apk);
  if (eocd < 0) return null;
  const cdSize = apk.readUInt32LE(eocd + 12);
  const cdOffset = apk.readUInt32LE(eocd + 16);
  if (cdSize === 0xffffffff || cdOffset === 0xffffffff) return null;
  if (cdOffset < 24 || cdOffset > eocd) return null;
  const footer = cdOffset - 24;
  const size2 = readU64(apk, footer);
  if (!apk.subarray(footer + 8, footer + 24).equals(BLOCK_MAGIC)) return null;
  const blockStart = cdOffset - 8 - size2;
  if (blockStart < 0 || blockStart > footer) return null;
  if (readU64(apk, blockStart) !== size2) return null;
  let p = blockStart + 8;
  while (p + 8 <= footer) {
    const pairLen = readU64(apk, p);
    if (pairLen < 4) return null;
    const pairEnd = p + 8 + pairLen;
    if (pairEnd > footer) return null;
    const id = apk.readUInt32LE(p + 8);
    if (id === STAMP_ID) {
      const code = codeFromValue(apk, p + 12, pairLen - 4);
      if (code !== null) return code;
    }
    p = pairEnd;
  }
  return null;
}

function codeFromValue(apk: Buffer, off: number, len: number): string | null {
  const magic = Buffer.from(VALUE_MAGIC, "ascii");
  if (len < magic.length) return null;
  if (!apk.subarray(off, off + magic.length).equals(magic)) return null;
  const code = apk.subarray(off + magic.length, off + len).toString("ascii");
  return isValidRefValue(code) ? code : null;
}

/** The EOCD record: the LAST signature in the tail whose
 *  comment length reaches exactly the end of the file. */
function findEocd(apk: Buffer): number {
  const tail = Math.min(apk.length, EOCD_LEN + MAX_COMMENT);
  const start = apk.length - tail;
  for (let i = apk.length - EOCD_LEN; i >= start; i--) {
    if (apk.readUInt32LE(i) !== EOCD_SIG) continue;
    if (i + EOCD_LEN + apk.readUInt16LE(i + 20) === apk.length) return i;
  }
  return -1;
}

function readU64(buf: Buffer, off: number): number {
  const lo = buf.readUInt32LE(off);
  const hi = buf.readUInt32LE(off + 4);
  return hi * 0x100000000 + lo;
}

function writeU64(buf: Buffer, off: number, value: number): void {
  buf.writeUInt32LE(value % 0x100000000, off);
  buf.writeUInt32LE(Math.floor(value / 0x100000000), off + 4);
}
