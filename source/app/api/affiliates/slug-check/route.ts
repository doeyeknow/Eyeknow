import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { checkSlugAvailability } from "@/lib/affiliates";

export const dynamic = "force-dynamic";

/** Link-name check for the affiliate setup flow: validates the
 *  name and reports whether it is free, so a bad or taken name is
 *  caught on the setup's link step instead of at the end. Always
 *  200 with a verdict (except auth/config failures) — the verdict
 *  is display-only; signup re-validates authoritatively. */
export async function GET(req: NextRequest) {
  if (!dbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const result = await checkSlugAvailability(req.nextUrl.searchParams.get("slug") ?? "");
  if ("error" in result) {
    return NextResponse.json({ available: false, error: result.error });
  }
  return NextResponse.json({ available: true, slug: result.slug });
}
