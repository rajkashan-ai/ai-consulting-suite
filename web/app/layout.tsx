import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

/**
 * The two faces, loaded once, here and nowhere else.
 *
 * Inter is the brand face. The app had silently fallen back to the system
 * stack, because design.css was kept as a hand copy of UI/app.css and the copy
 * lost the font declaration. Nothing noticed, because a fallback stack does not
 * fail, it just looks like somebody else's product.
 *
 * The mono is for figures only. A column of prices set in a proportional face
 * is a paragraph; set in a mono one it is a column.
 *
 * next/font self-hosts both and emits the CSS variables design.css already
 * names, so there is no network request to Google and no flash of a fallback.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sys",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
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
    <html lang="en-GB" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
