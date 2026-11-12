import { cookies } from "next/headers";
import { getSessionUserByToken, SESSION_COOKIE } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { isAdminUser } from "@/lib/admin";
import AdminDashboard from "@/components/AdminDashboard";
import AffiliateSignIn from "@/components/AffiliateSignIn";

export const dynamic = "force-dynamic";

/** eyeKnow admin — the site owner's view of the affiliate
 *  program: every affiliate, their sales, and payout requests.
 *  Gated to the owner emails in lib/admin.ts; the API route
 *  enforces the same gate on the data itself. */
export default async function AdminPage() {
  let user = null;
  if (dbConfigured()) {
    try {
      user = await getSessionUserByToken(cookies().get(SESSION_COOKIE)?.value);
    } catch {
      user = null;
    }
  }

  if (!user) {
    return (
      <div className="app">
        <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 80px" }}>
          <p>
            <a href="https://eyeknow.app">← eyeKnow main site</a>
          </p>
          <h1 style={{ marginTop: 0 }}>eyeKnow Admin</h1>
          <p>Sign in with the site owner account to see affiliates and sales.</p>
          <AffiliateSignIn returnTo="/admin" hideGoogleNote />
        </main>
      </div>
    );
  }

  if (!isAdminUser(user)) {
    return (
      <div className="app">
        <main style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 80px" }}>
          <p>
            <a href="https://eyeknow.app">← eyeKnow main site</a>
          </p>
          <h1 style={{ marginTop: 0 }}>eyeKnow Admin</h1>
          <p>
            This page is for the site owner only. You are signed in as {user.email} — that
            account does not have admin access.
          </p>
        </main>
      </div>
    );
  }

  return <AdminDashboard email={user.email} />;
}
