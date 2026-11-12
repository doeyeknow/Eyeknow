import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://eyeknow.app"),
  title: "eyeKnow — Traditional Iridology Readings",
  description:
    "Scan your iris with your phone camera and get a traditional iridology reading — chart mapping, sign spotting, and a clear report. For interest and self-reflection; not medical advice.",
  // Link-preview defaults: when any eyeknow.app link is shared
  // (Facebook, X, WhatsApp…), the preview shows the standard post
  // picture. Per-post pictures ride the /share/<post> links the
  // affiliate toolbox hands out (app/share/[id]/route.ts).
  openGraph: {
    title: "eyeKnow — Traditional Iridology Readings",
    description:
      "Reveal secrets to health through your eyes. A traditional iridology reading from one photo of your iris — for interest and self-reflection; not medical advice.",
    url: "https://eyeknow.app",
    siteName: "eyeKnow",
    type: "website",
    images: [
      {
        url: "/share-art/reading.jpg",
        width: 1080,
        height: 1080,
        alt: "eyeKnow — Reveal secrets to health through your eyes.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "eyeKnow — Traditional Iridology Readings",
    description:
      "Reveal secrets to health through your eyes. A traditional iridology reading from one photo of your iris — not medical advice.",
    images: ["/share-art/reading.jpg"],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "eyeKnow",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The page shouldn't zoom (Adam, 2026-11-05) — app-like feel; the
  // iris itself still pinch-zooms inside its own viewer.
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0d3b37",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Catch the browser's install offer from the first parse:
            Chrome can fire beforeinstallprompt before the app
            hydrates, and an uncaught offer is never re-sent. The
            stash is adopted by IrisApp's install handling. */}
        <Script id="eyeknow-bip-capture" strategy="beforeInteractive">
          {`window.__eyeknowBIP = null;
window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); window.__eyeknowBIP = e; window.dispatchEvent(new Event("eyeknow-bip")); });
window.addEventListener("appinstalled", function () { window.__eyeknowBIP = null; });`}
        </Script>
        {children}
      </body>
    </html>
  );
}
