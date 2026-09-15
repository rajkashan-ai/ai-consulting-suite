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
export const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/not-invited",
  "/auth",
  "/preview",
  // Development only, and it refuses itself on a deployed site. Listed here so
  // it is reachable without an account, which is the entire point of it.
  "/try",
  /**
   * These two carry their own authentication, so the session check here would
   * only ever be wrong about them.
   *
   * /api/dev-signin is the thing that creates a session. Requiring one to reach
   * it is a locked door with the key inside: it redirected to the sign-in page,
   * from the sign-in page.
   *
   * /api/tick is called by a scheduler, which has no session and never will. It
   * checks a shared secret instead and refuses everything without one. Left out
   * of this list it would have been redirected to a sign-in page for ever, and
   * the only symptom would have been runs that never finish when nobody is
   * watching, which is the exact thing it exists to prevent.
   */
  "/api/dev-signin",
  "/api/tick",
];

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

/**
 * Pages that must still work before Supabase exists.
 *
 * "/" is a static file with nothing behind it and "/sign-in" is a form. Blanket
 * 503ing them was easy and wrong: it meant the whole journey was unwalkable
 * until the database existed, and it replaced a screen that explains itself
 * with a bare line of text that explains nothing.
 *
 * The sign-in form already says "This app has no Supabase project behind it
 * yet" the moment you press a button, which is a better answer, in the right
 * place, at the moment it matters.
 *
 * /preview is example content. /try is the website reader: an Anthropic key,
 * no database, and it refuses itself on a deployed site. Everything past the
 * sign-in still answers "not set up yet", because a workspace without a
 * database is not a screen, it is a crash.
 */
export const WORKS_WITHOUT_SUPABASE = ["/", "/sign-in", "/preview", "/try"];
