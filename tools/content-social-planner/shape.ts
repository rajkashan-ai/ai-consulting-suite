import {
  MIX,
  type Angle,
  type Cadence,
  type Channel,
  type Purpose,
  type Slot,
} from "../../../Agents/Content & Social Planner/src/types.ts";
import { planDates, slotWeeks } from "../../../Agents/Content & Social Planner/src/plan-shape.ts";

/**
 * Lay the angles over the dates so the mix adds up and nothing repeats.
 *
 * Arithmetic, not judgement, and deliberately the same arithmetic the agent
 * folder already runs: `planDates` and `slotWeeks` are imported rather than
 * reimplemented, and `validateShape` checks the result, so the rules have one
 * home. The rules themselves are counts rather than percentages, because
 * seventy per cent of four posts is 2.8 posts; never no offer in a month and
 * never more than two; no angle twice running and none more than three times.
 *
 * Checked on the shape and never on the words, which is what makes it hold for
 * the weeks nobody has written yet.
 *
 * WHY THE PURPOSE MAP IS HERE
 * Which angles serve which purpose is not in `src/`: it lives in the agent's
 * command line runner, which imports `node:fs` and reads a file at load, so it
 * cannot be pulled into a server bundle. Same map, same order. A test asserts
 * the month this builds satisfies `validateShape`, which is the rule it exists
 * to keep.
 */

const BY_PURPOSE: Record<Purpose, Angle[]> = {
  useful: ["what-it-costs", "how-it-works", "before-after", "asked-a-lot", "the-mistake", "this-week", "not-for-you"],
  question: ["ask-them", "the-timing"],
  offer: ["the-ask"],
};

/** How often one angle may appear in a month. */
const MAX_PER_MONTH = 3;

export function shapeMonth(cadence: Cadence, ranAt: string, channels: Channel[]): Slot[] {
  const dates = planDates(cadence, ranAt);
  const weeks = slotWeeks(cadence);
  const mix = MIX[cadence];

  /**
   * The ask goes late and the question goes early-ish, rather than both being
   * dealt off the front. A month whose only ask is on day one has asked before
   * it has said anything worth reading.
   */
  const purposes: Purpose[] = new Array(dates.length);
  /* One set across both, or the offers land on top of the questions and the
     month is a question short. The two were spread independently and then
     written into the same array, so at `most days` five questions became four
     and the mix stopped matching its own table. */
  const taken = new Set<number>();
  for (const i of spread(mix.offer, dates.length, 0.95, taken)) purposes[i] = "offer";
  for (const i of spread(mix.question, dates.length, 0.35, taken)) purposes[i] = "question";
  for (let i = 0; i < dates.length; i++) if (!purposes[i]) purposes[i] = "useful";

  const used: Partial<Record<Angle, number>> = {};
  let last: Angle | null = null;

  return dates.map((date, i) => {
    const purpose = purposes[i];
    const pool = BY_PURPOSE[purpose].filter((a) => a !== last && (used[a] ?? 0) < MAX_PER_MONTH);
    const angle = (pool.length ? pool : BY_PURPOSE[purpose])[0];
    used[angle] = (used[angle] ?? 0) + 1;
    last = angle;
    return {
      date,
      week: weeks[i],
      purpose,
      angle,
      channel: channels[i % channels.length],
    };
  });
}

/**
 * Positions for `n` things across `total`, pushed toward `bias` of the month.
 *
 * Two of the computed positions can land on the same day, and deduplicating
 * them silently drops one. At `most days` that turned five question posts into
 * four and the mix no longer matched the table it is supposed to enforce, which
 * `validateShape` caught the first time it was run over a whole month. So a
 * collision moves to the next free day rather than disappearing.
 */
function spread(n: number, total: number, bias: number, taken: Set<number>): number[] {
  const mine: number[] = [];
  for (let k = 0; k < n && taken.size < total; k++) {
    let at = Math.min(total - 1, Math.round((k + bias) * (total / Math.max(1, n))));
    while (taken.has(at)) at = (at + 1) % total;
    taken.add(at);
    mine.push(at);
  }
  return mine;
}

/** How many posts a month of this cadence holds. Exported for the tests. */
export const expectedPosts = (cadence: Cadence) =>
  MIX[cadence].useful + MIX[cadence].question + MIX[cadence].offer;
