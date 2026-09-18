import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

/**
 * The three faces, loaded once, here and nowhere else.
 *
 * The Instrument handoff, 2026-09-18. Space Grotesk names a thing, Manrope
 * explains it, JetBrains Mono measures it. Three registers, so a reader can
 * tell a heading from a sentence from a figure without reading any of them.
 *
 * Inter did all three jobs before, which is why £68.00 and "a proper eye for
 * placement" had identical texture and nothing on the screen said "this was
 * measured".
 *
 * next/font self-hosts all three and emits the CSS variables design.css names,
 * so there is no request to Google, no flash of a fallback, and the privacy
 * promise in STYLE-GUIDE.md survives a web font.
 */
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-display",
  display: "swap",
});

const ui = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sys",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Suite",
  description: "AI tools that help you grow your business.",
  // Nothing here is ready to be found by a search engine, and the product holds
  // real businesses' data. Taken off again on the day we launch.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
