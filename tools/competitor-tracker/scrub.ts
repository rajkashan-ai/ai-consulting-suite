import {
  findNamedReviewers,
  findRankClaims,
  findTrafficClaims,
  findUnboundedCounts,
} from "../../../Agents/Competitor Tracker/src/guards.ts";
import type { Grid, Side } from "./stages.ts";

/**
 * Take off the page anything we cannot stand behind.
 *
 * The guards already knew how to spot an invented traffic figure, a Google
 * ranking and a reviewer's name. They ran over the battlecard's text, and the
 * comparison grid and the two standing columns are built beside the card rather
 * than inside it, so eleven guards watched a document that did not contain most
 * of what the customer reads. A rank claim, a made up visitor count and a real
 * person's name all reached a stored card.
 *
 * Dropped, not reworded. Mending exists for a sentence that says a true thing
 * badly, and it works on claims and actions because those are sentences. A
 * table cell saying a competitor ranks second on Google is not badly worded: it
 * is a fact nobody gave us, and there is no rewrite that makes it sourced. The
 * only honest thing to do with it is take it off.
 *
 * The same rule covers a cell with no source at all. A fact with nothing behind
 * it is not a fact we can show, whatever it says.
 */

/** Why this text cannot go on the page, or null when it can. */
export function unsafe(text: string): string | null {
  if (!text?.trim()) return null;

  const traffic = findTrafficClaims(text);
  if (traffic.length) return `a number nobody gave us (${traffic.join(", ")})`;

  if (findRankClaims(text)) return "where someone comes on Google, which we cannot see";

  const named = findNamedReviewers(text);
  if (named.length) return `a reviewer's name (${named.join(", ")})`;

  const unbounded = findUnboundedCounts(text);
  if (unbounded.length) return `a count with nothing to measure it against (${unbounded.join(", ")})`;

  return null;
}

/**
 * Reviews are counts, ratings and a source. Nothing else.
 *
 * Raj, 2026-09-16: "We should only be counting number of reviews and stars +
 * source. Not copying any of the actual reviews on the site, thus no customers
 * names either."
 *
 * This is a better rule than the one it replaces. Spotting a reviewer's name is
 * an endless game: every name we do not recognise gets through, and the cost of
 * missing one is publishing a real person's words and identity. Refusing the
 * quoted text itself has no such gap, because a count and a star rating simply
 * do not contain quoted prose.
 *
 * What is still allowed is a count of a theme: "3 of 9 mention waiting" is
 * counted, not copied, and carries no name. Flagged to Raj as the one line of
 * his instruction that could be read either way.
 */
const QUOTED = /["“”«»]([^"“”«»]{12,})["“”«»]|\u2018([^\u2019]{12,})\u2019/;

export function unsafeReview(text: string): string | null {
  const quoted = QUOTED.exec(text);
  if (quoted) {
    const said = (quoted[1] ?? quoted[2] ?? "").trim();
    // A quoted service name is not a quoted review. A run of words is.
    if (said.split(/\s+/).length >= 4) return "someone's actual review, copied";
  }
  return null;
}

export type Dropped = { where: string; what: string; why: string };

/**
 * Blank every cell that makes a claim we cannot stand behind, or that carries
 * no source.
 *
 * Blanked rather than removing the row, because the row is a comparison across
 * businesses and losing one business's value is not a reason to lose the other
 * five. An empty cell already reads correctly: not everybody publishes
 * everything.
 */
export function scrubGrid(grids: Grid[]): { grids: Grid[]; dropped: Dropped[] } {
  const dropped: Dropped[] = [];

  const out = grids.map((g) => ({
    ...g,
    rows: (g.rows ?? []).map((row) => ({
      ...row,
      cells: (row.cells ?? []).map((cell, i) => {
        if (!cell || cell.value == null) return cell;

        const who = g.columns?.[i] ?? "someone";
        const text = `${row.attribute}: ${cell.value}`;

        const why =
          unsafe(text) ??
          (g.area === "reviews" ? unsafeReview(text) : null) ??
          (cell.source ? null : "nothing to point at for it");
        if (!why) return cell;

        dropped.push({ where: `${g.area}, ${row.attribute}, ${who}`, what: String(cell.value), why });
        return { ...cell, value: null, source: null };
      }),
    })),
  }));

  return { grids: out, dropped };
}

/**
 * The two columns at the top of the screen.
 *
 * These are the first thing an owner reads and, until now, the only part of the
 * document with no source field at all: four statements about their business
 * with nothing behind them by design. A point that cannot point at a page comes
 * off, which is the same rule every claim on the card has always had.
 */
export function scrubStanding(
  standing: { winning: Side[]; losing: Side[] } | undefined,
): { standing: { winning: Side[]; losing: Side[] }; dropped: Dropped[] } {
  const dropped: Dropped[] = [];

  const keep = (side: Side[], which: string) =>
    side.filter((s) => {
      const why = unsafe(`${s.point}. ${s.detail}`) ?? (s.source ? null : "nothing to point at for it");
      if (!why) return true;
      dropped.push({ where: which, what: s.point, why });
      return false;
    });

  return {
    standing: {
      winning: keep(standing?.winning ?? [], "where you win"),
      losing: keep(standing?.losing ?? [], "where they win"),
    },
    dropped,
  };
}
