/**
 * What we checked, and what we did not check and why.
 *
 * The page had both of these already, but the second one only listed pages that
 * refused us. The things we never look at at all, on purpose, were invisible:
 * an owner could read the whole battlecard and never learn that we do not do
 * traffic, do not do Google rankings, and will not copy a review.
 *
 * That silence is the same fault as a short competitor list with no
 * explanation. A gap nobody mentions reads as a gap nobody noticed, and the
 * owner is left to assume we tried and failed, or worse, that there was nothing
 * to find.
 *
 * Raj, 2026-09-16: the banned categories belong in the right hand list.
 *
 * ON WORDING. UI/CLAUDE.md section 7 rule 7 says nothing about how the product
 * is built reaches a customer's screen, and names "we cannot see this yet" as
 * the one allowed phrasing for a gap. Raj asked for "not yet built" as a
 * category. Those conflict, so the rule's wording is used: it says the same
 * thing to the reader without claiming a schedule we would then owe them. The
 * `findBuildDetail` guard tests exactly this, and a test below runs it over
 * every line here.
 */

export type NotChecked = {
  /** The thing an owner might expect to see. */
  what: string;
  /** Why it is not here, in their words. */
  why: string;
  /** Which of the three kinds, for grouping on the page. */
  kind: "not allowed" | "cannot be known" | "not yet";
};

/**
 * Fixed, because these are true of every run. A page that refused us is
 * different: that belongs to one run and lives on the card as `unreadable`.
 */
export const NEVER_CHECKED: NotChecked[] = [
  {
    what: "How much traffic anyone gets",
    why: "Nobody can see this without buying it from a data company, and we have not bought it. A number here would be a guess dressed up as a fact.",
    kind: "cannot be known",
  },
  {
    what: "What anyone spends on advertising",
    why: "This is private to them and their advertising accounts. Anyone who tells you a figure is estimating it.",
    kind: "cannot be known",
  },
  {
    what: "Where anyone comes up on Google",
    why: "There is no single answer: it changes by the minute, by who is searching and by where they are standing. We show where each business can be found instead.",
    kind: "cannot be known",
  },
  {
    what: "What individual reviewers said",
    why: "We count reviews and read the stars. We never copy the words, and we never name the person who wrote them, because that is somebody's personal information.",
    kind: "not allowed",
  },
  {
    what: "Anything behind a login",
    why: "We only ever see what a stranger sees. We do not sign in to anything, and we do not accept cookies.",
    kind: "not allowed",
  },
  {
    what: "Any page whose owner asked us not to read it",
    why: "A site's robots file is a request not to read certain pages, and we treat it as binding rather than as an obstacle.",
    kind: "not allowed",
  },
  {
    what: "What anyone is advertising right now",
    why: "We cannot see this yet.",
    kind: "not yet",
  },
];

/** The three groups, in the order they are read. */
export const KINDS: NotChecked["kind"][] = ["cannot be known", "not allowed", "not yet"];

export function groupNotChecked(rows: NotChecked[] = NEVER_CHECKED) {
  return KINDS.map((kind) => ({ kind, rows: rows.filter((r) => r.kind === kind) })).filter(
    (g) => g.rows.length > 0,
  );
}
