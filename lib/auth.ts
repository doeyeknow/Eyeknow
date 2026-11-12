// Accounts: email + password (bcrypt), server-side sessions via an
// httpOnly cookie holding a random token (only its hash is stored).

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { ensureSchema, query } from "./db";

export const SESSION_COOKIE = "iris_session";
const SESSION_DAYS = 30;

export interface AccountUser {
  id: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; maxAge: number }> {
  await ensureSchema();
  const token = randomBytes(32).toString("hex");
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await query(
    `INSERT INTO iris_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' seconds')::interval)`,
    [tokenHash(token), userId, String(maxAge)],
  );
  return { token, maxAge };
}

export async function destroySession(token: string): Promise<void> {
  await ensureSchema();
  await query(`DELETE FROM iris_sessions WHERE token_hash = $1`, [tokenHash(token)]);
}

export function sessionCookie(token: string, maxAge: number): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearedSessionCookie(): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export async function getSessionUser(req: NextRequest): Promise<AccountUser | null> {
  return getSessionUserByToken(req.cookies.get(SESSION_COOKIE)?.value);
}

/** Same session lookup for server components, which read the cookie
 *  via next/headers instead of a request object. */
export async function getSessionUserByToken(token: string | undefined): Promise<AccountUser | null> {
  if (!token) return null;
  await ensureSchema();
  const rows = await query<{ id: string; email: string }>(
    `SELECT u.id, u.email FROM iris_sessions s
     JOIN iris_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(token)],
  );
  return rows[0] ?? null;
}
