"use client";

import { useState } from "react";

/** Sign-in form for the gated /affiliates page. It posts to the same
 *  email/password endpoints and sets the same session cookie as the
 *  home-page sign-in — no second auth system. On success it returns
 *  to the surface the visitor is on: the affiliate dashboard by
 *  default, or the team PWA root when the team page renders it
 *  (returnTo="/"). hideGoogleNote drops the Google sign-in note on
 *  the team host: that session cookie is host-only, so a Google
 *  sign-in on the main site can't carry over to team.eyeknow.app,
 *  and the note would only mislead there. */
export default function AffiliateSignIn({
  returnTo = "/affiliates",
  hideGoogleNote = false,
}: {
  returnTo?: string;
  hideGoogleNote?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: { id: string; email: string };
        error?: string;
      };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Something went wrong — try again.");
        return;
      }
      window.location.href = returnTo;
    } catch {
      setError("Couldn't reach the account service — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <form className="auth-form" onSubmit={(e) => void submit(e)}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>
        {error && <p className="warn">{error}</p>}
        <button type="submit" className="btn big" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="muted" style={{ marginBottom: 0 }}>
        {mode === "login" ? (
          <>
            No account yet?{" "}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
      {!hideGoogleNote && (
        <p className="muted" style={{ marginBottom: 0 }}>
          If your account uses Google sign-in, sign in from the home page, then return here.
        </p>
      )}
    </section>
  );
}
