/**
 * Whether a tool can start, in that tool's own terms.
 *
 * Separate from `screens.tsx`, which holds the components, for one practical
 * reason: the test runner cannot load a `.tsx`, so a rule that lives beside a
 * component is a rule no test can execute. The alternative in this codebase is
 * asserting on the file as text, which proves the characters are there and not
 * that they do anything.
 *
 * The rules genuinely differ. The Tracker cannot start without a trade and a
 * town, because a barber and a plumber need different places looked at. The
 * Planner needs the website and nothing else, because everything it writes
 * comes off their own pages. One shared condition would block the Planner on a
 * field it never reads.
 */

export type Workspace = {
  id: string;
  name: string | null;
  website: string;
  trade: string | null;
  town: string | null;
};

export const READY: Record<string, (w: Workspace) => boolean> = {
  "competitor-tracker": (w) => Boolean(w.website && w.trade && w.town),
  "content-social-planner": (w) => Boolean(w.website),
};

/** A tool with no rule cannot start. Silence is not permission. */
export const readyFor = (slug: string, w: Workspace): boolean => READY[slug]?.(w) ?? false;
