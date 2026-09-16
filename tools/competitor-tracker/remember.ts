import { normaliseName } from "../../../Agents/Competitor Tracker/src/normalise.ts";
import type { Checked } from "./naming.ts";

/**
 * The competitor set, kept between runs.
 *
 * Discovery is the most expensive and slowest part of a run, and its answer is
 * the one that barely changes: a salon's rivals are the same in December as in
 * September. Their prices are what move, and reading five known pages takes
 * about five seconds.
 *
 * So the set is found once and reused. A weekly run that already has it does no
 * discovery at all. Finding them again becomes something somebody asks for.
 */

export type Kept = {
  name: string;
  url: string | null;
  why: string | null;
  /** "asked", "crawled" or "owner". An owner's name is never dropped. */
  source: string;
  foundAt: string;
};

export type Store = {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: unknown): {
        is(col: string, val: unknown): Promise<{ data: unknown }>;
      };
    };
    upsert(rows: Record<string, unknown>[], opts?: Record<string, unknown>): Promise<unknown>;
  };
};

/** Rows for storing. Shaped here so the caller never writes column names. */
export function rowsFor(
  workspaceId: string,
  found: Checked[],
  source: "asked" | "crawled",
): Record<string, unknown>[] {
  return found
    .filter((c) => c.name?.trim())
    .map((c) => ({
      workspace_id: workspaceId,
      name: c.name.trim(),
      url: c.url ?? null,
      why: c.why ?? null,
      source,
    }));
}

/**
 * Is this set worth using, or should we go and look again?
 *
 * Age alone does not decide it. A set of five from four months ago is still
 * five real businesses, and rediscovering costs a pound to probably produce the
 * same five. What does decide it is having too few to compare: a comparison
 * against one business is not a comparison.
 */
export function enoughToUse(kept: Kept[]): boolean {
  return kept.length >= 3;
}

/**
 * How to say the set's age to the owner.
 *
 * Said out loud rather than implied, because a comparison silently built on a
 * four month old list looks exactly like one built this morning, and only one
 * of them deserves to be trusted about who is missing.
 */
export function ageOf(kept: Kept[], now: Date): string | null {
  if (!kept.length) return null;

  const oldest = kept
    .map((k) => new Date(k.foundAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0];
  if (!oldest) return null;

  const days = Math.floor((now.getTime() - oldest) / 86_400_000);
  if (days <= 1) return "Worked out today.";
  if (days < 14) return `Worked out ${days} days ago.`;
  if (days < 60) return `Worked out ${Math.round(days / 7)} weeks ago.`;
  return `Worked out ${Math.round(days / 30)} months ago. Ask us to look again if it is out of date.`;
}

/** Two names for the same business, whichever route each arrived by. */
export function merge(kept: Kept[], found: Checked[]): Checked[] {
  const have = new Set(kept.map((k) => normaliseName(k.name)));
  return found.filter((c) => !have.has(normaliseName(c.name)));
}
