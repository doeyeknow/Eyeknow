import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { setCustomSlug, validateCustomSlug } from "@/lib/affiliates";

export const dynamic = "force-dynamic";

/**
 * Set the signed-in affiliate's custom link slug — once only.
 * Validation is server-side: 3–30 chars, lowercase
 * letters/numbers/hyphens, never a reserved word. A slug already
 * owned by another affiliate answers 409 (pick another), and so
 * does any attempt to change a link name that is already set:
 * link names are permanent, so printed fliers and shared links
 * never break. The auto-generated code link keeps working forever.
 */
export async function POST(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { slug?: unknown } | null;
  const validated = validateCustomSlug(body?.slug);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  try {
    const slug = await setCustomSlug(user.id, validated.slug);
    return NextResponse.json({ ok: true, slug });
  } catch (e) {
    if (e instanceof Error && e.message === "taken") {
      return NextResponse.json(
        { error: "That link name is already taken — pick another." },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.message === "locked") {
      return NextResponse.json(
        { error: "Your link name is permanent once set — it can't be changed." },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.message === "not an affiliate") {
      return NextResponse.json({ error: "Join the program first." }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't save link — try again in a moment." }, { status: 500 });
  }
}
