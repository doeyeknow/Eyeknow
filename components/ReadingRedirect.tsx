"use client";

import { useEffect } from "react";

/**
 * Signed-in landing for the email link: the server page already set
 * the reveal flag; this navigates to the reading. A client
 * navigation, not redirect(): the app's loading.tsx streams a
 * Suspense shell before the page renders, and a redirect thrown
 * after streaming starts degrades to an error boundary instead of
 * a 307. The page also renders a plain link for no-JS visitors.
 * Renders nothing.
 */
export default function ReadingRedirect({ scanId }: { scanId: string }) {
  useEffect(() => {
    window.location.replace(`/?scan=${encodeURIComponent(scanId)}`);
  }, [scanId]);
  return null;
}
