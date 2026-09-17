import type { ActionProblem } from "../../../Agents/Competitor Tracker/src/guards.ts";
import type { Battlecard } from "../../../Agents/Competitor Tracker/src/types.ts";

type Action = Battlecard["actions"][number];

/**
 * Take out the action the guards objected to, and keep the rest of the card.
 *
 * WHY
 * The guards were a gate. One action resting on a number nobody could source
 * and the entire card went in the bin: the comparison, the two columns, the
 * other two actions, all of it built and paid for and never shown. That
 * happened to the bakery twice on 2026-09-16, on a different rule each time,
 * and the owner saw nothing both times.
 *
 * An unsupported action is one bad answer to one of four questions. Throwing
 * away the answers to the other three to punish it is not caution, it is just
 * an expensive way to show nobody anything.
 *
 * WHAT DOES NOT CHANGE
 * The bad action still never reaches the customer. This is about what happens
 * to everything around it.
 */

/** The problems that name a single action. The rest are about the set. */
const NAMES_ONE = (p: ActionProblem): string | null =>
  "headline" in p && typeof p.headline === "string" ? p.headline : null;

export type Dropped = {
  kept: Action[];
  /** Headlines removed, so the document can say so rather than quietly show two. */
  dropped: string[];
};

export function dropBad(actions: Action[], problems: ActionProblem[]): Dropped {
  const bad = new Set(problems.map(NAMES_ONE).filter(Boolean) as string[]);
  if (!bad.size) return { kept: actions, dropped: [] };

  const kept = actions.filter((a) => !bad.has(a.headline));

  return {
    // Ranks are 1, 2, 3 with no gaps. Dropping the second of three leaves 1 and
    // 3, which every reader and every later check reads as a missing action
    // rather than a shorter list.
    kept: kept.map((a, i) => ({ ...a, rank: i + 1 })),
    dropped: actions.filter((a) => bad.has(a.headline)).map((a) => a.headline),
  };
}

/**
 * Is what is left still worth showing?
 *
 * One action is a thin card and still a useful one: it is a comparison, two
 * columns of where they win and lose, and one thing to do. None is different,
 * because then nothing answers "what should I change", and that is the question
 * the whole page builds up to.
 */
export const worthShowing = (d: Dropped): boolean => d.kept.length > 0;

/**
 * What the owner is told, when some were dropped.
 *
 * Said plainly and without our vocabulary. Not "a guard rejected an action":
 * the reason an owner cares about is that we had a third idea and could not
 * stand it up, which is a fact about the evidence and not about our machinery.
 */
export function sayDropped(d: Dropped): string | null {
  if (!d.dropped.length) return null;
  const n = d.dropped.length;
  return n === 1
    ? "We had one more suggestion and could not back it up with what we read, so we left it out."
    : `We had ${n} more suggestions and could not back them up with what we read, so we left them out.`;
}

/**
 * The two problems that are about the model's output, not the card's truth.
 *
 * `wrong-count` and `ranks-not-1-2-3` both say "there should be exactly three,
 * numbered one to three". That is the right thing to ask a model for, and the
 * wrong thing to hold against a card we have deliberately shortened ourselves:
 * having dropped one, the count is two by our own decision and complaining
 * about it would put the run straight back into the loop this exists to break.
 */
export const ABOUT_THE_SET = new Set(["wrong-count", "ranks-not-1-2-3"]);

export const stillWrong = (problems: ActionProblem[], weDropped: boolean): ActionProblem[] =>
  weDropped ? problems.filter((p) => !ABOUT_THE_SET.has(p.kind)) : problems;
