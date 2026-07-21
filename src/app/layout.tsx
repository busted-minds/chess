import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { SiteHeader } from "@/components/layout/site-header";

const bodyFont = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const displayFont = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "Busted Minds Chess", template: "%s · Busted Minds Chess" },
  description: "Play beautiful online, local, and computer chess. Train with puzzles, analyze with Stockfish, join events, and make every move count.",
  applicationName: "Busted Minds Chess",
  keywords: ["chess", "online chess", "chess puzzles", "Stockfish", "chess training", "play chess"],
  authors: [{ name: "Busted Minds" }],
  creator: "Busted Minds",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/chess-icon.png", apple: "/brand/chess-icon.png" },
  openGraph: {
    type: "website",
    siteName: "Busted Minds Chess",
    title: "Busted Minds Chess",
    description: "Play, learn, compete, and keep getting better.",
    images: [{ url: "/brand/chess-logo.png", width: 1536, height: 1024, alt: "Busted Minds Chess" }],
  },
  twitter: { card: "summary_large_image", title: "Busted Minds Chess", description: "Outthink the board.", images: ["/brand/chess-logo.png"] },
};

export const viewport: Viewport = { themeColor: "#06111f", colorScheme: "dark light", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <AppProviders>
          <a href="#main-content" className="skip-link">Skip to content</a>
          <SiteHeader />
          <div id="main-content">{children}</div>
        </AppProviders>
      </body>
    </html>
  );
}
