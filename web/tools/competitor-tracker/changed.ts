import type { Grid } from "./stages.ts";

/**
 * What moved since last time.
 *
 * WHY THIS IS THE POINT OF THE PRODUCT
 * "Who are my competitors" is a question an owner can mostly answer themselves,
 * and it is the same answer in December as in September. "Three of them put
 * their cut up in the last fortnight and you did not" is a question they cannot
 * answer at all, and it is different every week.
 *
 * It was also the expensive one to build until the set was stored. Now that we
 * read five known pages instead of finding five unknown ones, comparing this
 * week's numbers to last week's is arithmetic on two documents we already have.
 *
 * WHAT COUNTS AS A MOVE
 * Only a cell we could read on both occasions, whose value differs. A figure
 * that has appeared is news of a kind, but a figure that has vanished usually
 * means we could not read the page today, which is a fact about us, and saying
 * "they removed their prices" when our fetch failed would be a lie in the one
 * place an owner would act on it.
 */

export type Move = {
  /** The business the row is about. */
  who: string;
  /** "Classic cut", "Reviews", "Opens". */
  what: string;
  from: string;
  to: string;
  area: string;
  /** Where we read the new value. Every move carries its page, like any claim. */
  source: { url: string; fetchedOn: string } | null;
};

const rowsOf = (grids: Grid[] | undefined) => (grids ?? []).flatMap((g) =>
  (g.rows ?? []).map((r) => ({ area: g.area, columns: g.columns ?? [], row: r })),
);

/** Same area, same attribute, same column. Anything else is not the same cell. */
export function whatMoved(before: Grid[] | undefined, after: Grid[] | undefined): Move[] {
  const was = new Map<string, string>();

  for (const { area, columns, row } of rowsOf(before)) {
    row.cells?.forEach((cell, i) => {
      const who = columns[i];
      if (!who || cell?.value == null) return;
      was.set(`${area}|${row.attribute}|${who}`, String(cell.value));
    });
  }

  const moves: Move[] = [];

  for (const { area, columns, row } of rowsOf(after)) {
    row.cells?.forEach((cell, i) => {
      const who = columns[i];
      if (!who || cell?.value == null) return;

      const key = `${area}|${row.attribute}|${who}`;
      const then = was.get(key);
      // Nothing to compare against is not a change. A business we did not read
      // last week has not "started" doing anything.
      if (then === undefined) return;

      const now = String(cell.value);
      if (then === now) return;

      moves.push({ who, what: row.attribute, from: then, to: now, area, source: cell.source });
    });
  }

  return moves;
}

/**
 * The one line at the top, when something moved.
 *
 * Counts rather than a list, because a list of eleven changes is a wall and the
 * table underneath already holds the detail. Names the business when it is only
 * one, since "Studio 10 changed two things" is worth reading and "2 businesses
 * changed 2 things" is not.
 */
export function sayMoved(moves: Move[], since: string | null): string | null {
  if (!moves.length) return null;

  const when = since ? ` since ${since}` : " since last time";
  const businesses = new Set(moves.map((m) => m.who));

  if (businesses.size === 1) {
    const who = [...businesses][0];
    return moves.length === 1
      ? `${who} changed one thing${when}.`
      : `${who} changed ${moves.length} things${when}.`;
  }

  return `${businesses.size} businesses changed ${moves.length} things${when}.`;
}

/**
 * Said when nothing moved, which is a real answer and not an empty page.
 *
 * An owner who reads "nothing changed" has learned something worth the minute
 * it took: they are not behind. A blank space teaches them that our tool has
 * nothing to say, which is a different message and the wrong one.
 */
export const sayStill = (since: string | null): string =>
  since
    ? `Nothing we can see has changed since ${since}.`
    : "Nothing we can see has changed since last time.";
