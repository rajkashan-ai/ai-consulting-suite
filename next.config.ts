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
};

export default nextConfig;
