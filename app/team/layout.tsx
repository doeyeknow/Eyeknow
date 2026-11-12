import type { Metadata, Viewport } from "next";
import TeamPwaSetup from "@/components/TeamPwaSetup";

/** Team-segment head: the affiliates' PWA gets its own name,
 *  manifest, and install identity, distinct from the consumer
 *  eyeKnow app in the root layout. */
export const metadata: Metadata = {
  title: "eyeKnow Team — Affiliate Home",
  description:
    "The eyeKnow affiliate home: track your sales, print your flier, and manage your link, price, and payouts.",
  manifest: "/team.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "eyeKnow Team",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d3b37",
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TeamPwaSetup />
      {children}
    </>
  );
}
