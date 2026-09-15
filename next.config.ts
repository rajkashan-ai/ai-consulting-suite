import path from "node:path";
import type { NextConfig } from "next";

/**
 * The tool libraries live in Agents/<Tool>/src, one folder above this app,
 * beside the CLAUDE.md that defines each tool. Turbopack will not resolve
 * anything outside its root, so the root is the whole project rather than just
 * this folder. Without this, importing a guard from the Competitor Tracker is
 * "Module not found" even though the file is plainly there.
 */
const nextConfig: NextConfig = {
  turbopack: { root: path.join(import.meta.dirname, "..") },
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),

  /**
   * The landing page is served as it was designed, byte for byte, from
   * public/landing.html. It is a single self-contained file with its images
   * inlined, so rebuilding it as components would mean maintaining the design
   * twice and it would drift within a week. `python3 sync-landing.py` copies it
   * across and points its buttons at the real sign-in.
   *
   * beforeFiles, so this wins over anything in app/. Nothing in app/ claims "/"
   * any more, and this is the reason why.
   */
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
