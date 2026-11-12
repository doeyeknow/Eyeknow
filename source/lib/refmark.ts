/**
 * PNG text-chunk stamping for the referral "refmark" — the third
 * referral fallback layer (Adam, 2026-11-05): when a referral is
 * captured, the server serves the logo icon with the referral
 * CODE (never a price) written into a PNG tEXt chunk, privately
 * cacheable for 30 days. If a later visit finds neither the
 * referral cookie nor localStorage, the page re-fetches that
 * image from the browser's HTTP cache and reads the code back
 * out of the cached bytes.
 *
 * Honest limits (told to Adam at build time): the HTTP cache is
 * the frailest storage the browser has — private browsing,
 * site-data purges and cache eviction all kill it, and where the
 * cache reliably survives, the cookie usually did too. It is a
 * third layer, not a replacement.
 */

export const REFMARK_KEY = "eyeknow-ref";

/* CRC32 (PNG chunks carry one per chunk). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && PNG_SIG.every((b, i) => bytes[i] === b);
}

function chunkTypeAt(bytes: Uint8Array, off: number): string {
  return String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
}

function writeU32(out: Uint8Array, off: number, v: number) {
  out[off] = (v >>> 24) & 0xff;
  out[off + 1] = (v >>> 16) & 0xff;
  out[off + 2] = (v >>> 8) & 0xff;
  out[off + 3] = v & 0xff;
}

function readU32(bytes: Uint8Array, off: number): number {
  return ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
}

/** Return a copy of the PNG with a tEXt chunk (key → value)
 *  inserted just before IEND. Non-PNG input passes through. */
export function injectPngText(png: Uint8Array, key: string, value: string): Uint8Array {
  if (!isPng(png)) return png;
  const enc = new TextEncoder();
  const payload = new Uint8Array(key.length + 1 + value.length);
  payload.set(enc.encode(key), 0);
  payload[key.length] = 0;
  payload.set(enc.encode(value), key.length + 1);
  const chunk = new Uint8Array(12 + payload.length);
  writeU32(chunk, 0, payload.length);
  chunk.set(enc.encode("tEXt"), 4);
  chunk.set(payload, 8);
  writeU32(chunk, 8 + payload.length, crc32(chunk.subarray(4, 8 + payload.length)));

  // Find IEND and splice the new chunk in front of it.
  let off = 8;
  while (off + 8 <= png.length) {
    const len = readU32(png, off);
    if (chunkTypeAt(png, off + 4) === "IEND") {
      const out = new Uint8Array(png.length + chunk.length);
      out.set(png.subarray(0, off), 0);
      out.set(chunk, off);
      out.set(png.subarray(off), off + chunk.length);
      return out;
    }
    off += 12 + len;
  }
  return png;
}

/** Read a tEXt chunk value by keyword; null when absent. */
export function readPngText(png: Uint8Array, key: string): string | null {
  if (!isPng(png)) return null;
  const dec = new TextDecoder("latin1");
  let off = 8;
  while (off + 8 <= png.length) {
    const len = readU32(png, off);
    const type = chunkTypeAt(png, off + 4);
    if (type === "tEXt") {
      const data = png.subarray(off + 8, off + 8 + len);
      const nul = data.indexOf(0);
      if (nul > 0 && dec.decode(data.subarray(0, nul)) === key) {
        return dec.decode(data.subarray(nul + 1));
      }
    }
    if (type === "IEND") break;
    off += 12 + len;
  }
  return null;
}
