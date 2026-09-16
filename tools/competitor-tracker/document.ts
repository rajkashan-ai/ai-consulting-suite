import type { Battlecard } from "../../../Agents/Competitor Tracker/src/types.ts";
import type { Grid, RunState, Side } from "./stages.ts";
import type { Funnel } from "./shortfall.ts";

/**
 * What gets stored, and whether it is worth storing.
 *
 * This was four lines inside the engine, and being inside the engine meant no
 * test could reach it: the engine imports `server-only`. So the tests all
 * checked `state.grid`, the thing on the way to the document, and nothing ever
 * checked the document itself. The two are assembled from different places and
 * a run can have a good grid in its state and store a hollow one.
 *
 * That is not hypothetical. A grid call once came back empty, the card was
 * built and stored with no comparison in it, and the run said "done". It cost
 * 196,000 tokens to find out, and the only clue was an empty field on a page.
 * The lesson was to refuse a half answer from the model, which was done. This
 * is the same lesson applied one step later: refuse to store a half document.
 *
 * A run that gets here has already been paid for, so refusing costs nothing
 * that has not already been spent, and an honest failure beats a page that
 * looks finished and is empty.
 */

export type DocumentBody = Battlecard & {
  standing?: { winning: Side[]; losing: Side[] };
  grid?: Grid[];
  /**
   * What is not here, and why.
   *
   * A comparison of two businesses and a comparison missing its reviews table
   * both used to arrive with nothing said about them, so a shortfall in our own
   * research was indistinguishable from a fact about the owner's market. These
   * two lines are the difference. See shortfall.ts.
   */
  shortfall?: string;
  areas?: string;
  /** The one thing worth knowing, first. Absent when it did not survive. */
  headline?: string;
  /** Searches run, links seen, names found, and how they narrowed. */
  funnel?: Funnel;
};

/** Assemble the document from a finished run. */
export function buildBody(state: RunState): DocumentBody | null {
  if (!state.card) return null;
  return {
    ...state.card,
    standing: state.standing,
    grid: state.grid,
    shortfall: state.shortfallSay,
    areas: state.areasSay,
    headline: state.headline,
    funnel: state.funnel,
  };
}

/**
 * Why this document is not worth storing, or null if it is.
 *
 * Each of these is a real failure that reached a stored document at least once,
 * not a list of everything that could conceivably be wrong.
 */
export function hollow(body: DocumentBody | null): string | null {
  if (!body) return "there is no battlecard";

  if (!body.competitors?.length) return "no competitors were found";

  if (!body.grid?.length) {
    return "the comparison is missing, so there is nothing to compare side by side";
  }

  const rows = body.grid.flatMap((g: Grid) => g.rows ?? []);
  if (!rows.length) return "the comparison has no rows in it";

  // A grid of nothing but blanks is the same failure wearing a table. Every
  // cell null means the shape arrived and the facts did not, which reads on the
  // page as a finished comparison of five businesses we know nothing about.
  const cells = rows.flatMap((r: Grid["rows"][number]) => r.cells ?? []);
  const filled = cells.filter(
    (c: Grid["rows"][number]["cells"][number]) =>
      c?.value != null && String(c.value).trim() !== "",
  );
  if (!filled.length) return "the comparison came back with nothing in any of its cells";

  // Columns and cells have to line up or the page reads the wrong price against
  // the wrong business, which is worse than showing nothing.
  for (const g of body.grid) {
    for (const row of g.rows ?? []) {
      if ((row.cells?.length ?? 0) !== (g.columns?.length ?? 0)) {
        return `"${row.attribute}" has ${row.cells?.length ?? 0} values for ${g.columns?.length ?? 0} businesses`;
      }
    }
  }

  if (!body.actions?.length) return "there is nothing for them to do";

  return null;
}
