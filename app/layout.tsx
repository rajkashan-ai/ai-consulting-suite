import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
