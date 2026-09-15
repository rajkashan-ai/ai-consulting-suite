/**
 * Who may see what, as a decision rather than a pile of ifs inside the proxy.
 *
 * Pulled out so it can be tested. The rules that decide where a person lands
 * after signing in are step 2 of this build, and testing them by signing in
 * over and over is slow and needs a Supabase project. Testing them here needs
 * neither.
 *
 * THIS IS CONVENIENCE, NOT SECURITY. Row Level Security is what protects the
 * data. This only saves somebody loading a page that would be empty anyway.
 * Never move a real access decision in here.
 */

/** Reachable without signing in. Everything else needs a session. */
export const PUBLIC_PATHS = ["/", "/sign-in", "/not-invited", "/auth", "/preview"];

export type Decision =
  | { go: "through" }
  | { go: "sign-in"; next: string }
  | { go: "workspace" };

export function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function decide(path: string, signedIn: boolean): Decision {
  if (!signedIn) {
    // Remember where they were going, so they land there rather than on a home
    // screen having forgotten why they came.
    return isPublic(path) ? { go: "through" } : { go: "sign-in", next: path };
  }

  // Already in. The landing page and the sign-in screen have nothing to offer
  // them, and showing "Sign in" to somebody who is signed in reads as broken.
  if (path === "/" || path === "/sign-in") return { go: "workspace" };

  return { go: "through" };
}

/**
 * Where a redirect is allowed to send somebody.
 *
 * `next` arrives on the URL, so anybody can put anything in it. Without this, a
 * link could sign a person into our product and then bounce them somewhere
 * else entirely, carrying our name and their trust with it.
 *
 * Only a path inside this site. Not a full address, not a protocol relative
 * "//evil.example" which a browser treats as another site, and not a backslash,
 * which some browsers quietly normalise into a slash.
 */
export function safeNext(next: string | null | undefined, fallback = "/workspace"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.startsWith("/\\") || next.includes("\\")) return fallback;
  return next;
}
