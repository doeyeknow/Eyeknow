import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured, ensureSchema, query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Affiliate support messages (team app Support tab). Signed-in
 *  users only. Every message is stored in iris_support_messages
 *  first — that copy is the guarantee — and then emailed to the
 *  platform owner via Resend on a best-effort basis (same sender
 *  as gift email). A failed email never loses the message. */

const TOPICS = [
  "Payouts",
  "My link",
  "A sale didn't credit",
  "Sharing & fliers",
  "Something else",
] as const;

const SUPPORT_INBOX = "taoswoodz@gmail.com";

export async function POST(req: NextRequest) {
  if (!dbConfigured()) {
    return NextResponse.json({ error: "Support is unavailable right now." }, { status: 503 });
  }
  const user = await getSessionUser(req).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    topic?: unknown;
    message?: unknown;
  } | null;
  const topic =
    typeof body?.topic === "string" && (TOPICS as readonly string[]).includes(body.topic)
      ? body.topic
      : null;
  if (!topic) {
    return NextResponse.json({ error: "Pick a topic." }, { status: 400 });
  }
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 5 || message.length > 3000) {
    return NextResponse.json(
      { error: "Write a few words about it (up to 3,000 characters)." },
      { status: 400 },
    );
  }
  await ensureSchema();
  await query(
    `INSERT INTO iris_support_messages (user_id, email, topic, message) VALUES ($1, $2, $3, $4)`,
    [user.id, user.email, topic, message],
  );
  let emailed = false;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.GIFT_FROM_EMAIL ?? "eyeKnow <gifts@eyeknow.app>",
          to: [SUPPORT_INBOX],
          reply_to: user.email,
          subject: `[eyeKnow Team support] ${topic} — ${user.email}`,
          text: `Support message from an eyeKnow affiliate.\n\nFrom: ${user.email}\nTopic: ${topic}\n\n${message}\n\n— Stored in iris_support_messages; reply to this email to answer the affiliate.`,
        }),
      });
      emailed = res.ok;
    } catch {
      emailed = false;
    }
  }
  return NextResponse.json({ ok: true, emailed });
}
