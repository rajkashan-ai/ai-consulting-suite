/**
 * When to stop a run that is not going to finish.
 *
 * Until now nothing inside the app ever said "this has taken too long". A run
 * that hung sat there, and the only person who noticed was whoever happened to
 * be watching the screen. That is the wrong way round: the product should know.
 *
 * Three different things go wrong and they need three different detectors,
 * because each one looks fine to the other two:
 *
 *   1. Slow.     Every step works, they are just all slow, and the whole thing
 *                creeps past the point where anyone would wait.
 *   2. Circling. Two stages hand back and forth. Each step succeeds, so no step
 *                is ever slow and nothing errors, but it never lands.
 *   3. Still.    A step returns, changes nothing, and says the same thing it
 *                said last time. Cheap and silent, and it can run forever.
 *
 * No clock and no database in here. It is given what happened and returns a
 * verdict, which is what makes it testable without spending money.
 */

/** Steps recorded against a run, carried in the run's own state. */
export type Watch = {
  /** How many steps have been spent in each stage. */
  spent?: Record<string, number>;
  /** The stage and progress line of the last step. */
  saidLast?: string;
  /** How many steps running it has said exactly that, in the same stage. */
  saidSame?: number;
  /** Filled in when we stop a run, so the reason survives for us to read. */
  stopped?: string;
  /**
   * Seconds and tokens spent in each stage.
   *
   * Here because the question "why did that take twelve minutes" had no answer
   * anywhere in the product. A total is not an answer: it cannot tell you
   * whether the time went on reading pages politely or on a model writing
   * thirty thousand words, and those two have opposite fixes. Recorded on every
   * run, successful or not, so a decision about speed is made from measurements
   * rather than from whichever cause is easiest to imagine.
   */
  cost?: Record<
    string,
    {
      seconds: number;
      input: number;
      output: number;
      pages: number;
      /**
       * Tokens written to and read from the prompt cache.
       *
       * Recorded before anything is cached, on purpose. ARCHITECTURE.md
       * section 2 estimates what caching would save, and an estimate is all it
       * can be while these are unmeasured: the response carries both numbers
       * and nothing was looking at them. With these, one run says exactly what
       * was reused rather than what we hoped would be.
       *
       * `read` is billed at a tenth of base input and `written` at one and a
       * quarter times, so they are not interchangeable and are not summed.
       */
      cacheWritten?: number;
      cacheRead?: number;
    }
  >;
};

/**
 * `say` goes to the customer. `why` is for us, and is kept in the run's state
 * rather than shown, because a customer reading "stuck at stage checking" has
 * been told about our machinery and still cannot do anything with it.
 */
export type Verdict = { say: string; why: string } | null;

/**
 * Time actually spent working, not time since the run was created.
 *
 * This was wall clock from `started_at`, which is the one measurement the
 * product is built to ignore. The whole pipeline exists so a closed laptop does
 * not lose a run: each step saves and something picks it up later. Measured on
 * the clock, a run two steps in and left overnight was killed the moment
 * anybody looked at it, having done nothing wrong at all.
 *
 * The seconds spent in each stage are already recorded, so the sum of those is
 * the honest measure. A laptop shut for fourteen hours adds nothing to it.
 */
export const WORKING_MINUTES = 12;

/**
 * The most input tokens one run may spend before we stop it.
 *
 * There was no ceiling at all. On 2026-09-16 a single St Albans run spent
 * 434,033 input tokens over 20 minutes and produced nothing, and a second
 * started thirteen seconds later to do it again. Time was capped; money was
 * not, and the two are not the same thing: a run can be cheap and slow, or
 * fast and ruinous.
 *
 * Checked before each step, like the clock, so a run that has already spent
 * this much does not start another call.
 */
export const TOKEN_CEILING = 150_000;

/** Kept for anything still reading the old name. */
export const WHOLE_RUN_MINUTES = WORKING_MINUTES;

/** Identical steps in a row before we call it still. */
export const STILL_LIMIT = 3;

/**
 * How many steps a stage may take before it is circling.
 *
 * These are first estimates, from one good run and from what each stage does,
 * not measurements, and they are deliberately loose: the job of a cap is to
 * catch a run that will never finish, not to police a slow one. The deadline
 * above is the real net. Tighten them once enough runs have been recorded to
 * know the true spread.
 *
 * Reading gets 6 because it fetches 8 pages a step and there are 6 businesses.
 * Checking and fixing get 8 each because mending allows 5 passes and every pass
 * is one step of each.
 */
export const CAPS: Record<string, number> = {
  searching: 3,
  listings: 4,
  choosing: 3,
  reading: 6,
  writing: 4,
  checking: 8,
  fixing: 8,
};

const STUCK =
  "We got stuck partway through and stopped rather than keep going. Start it again.";

/** What one step actually cost. */
export type Spent = {
  seconds: number;
  input: number;
  output: number;
  pages: number;
  /** Optional, because a step that made no model call has neither. */
  cacheWritten?: number;
  cacheRead?: number;
};

/** Record one completed step. Returns the updated record, nothing mutated. */
export function note(
  watch: Watch,
  stage: string,
  progress: string,
  spentHere?: Spent,
): Watch {
  const spent = { ...(watch.spent ?? {}) };
  spent[stage] = (spent[stage] ?? 0) + 1;

  // Added to what the stage already cost, not assigned over it. A stage that
  // takes four steps has to show the total of the four, or reading looks cheap
  // for the same reason it is slow.
  const cost = { ...(watch.cost ?? {}) };
  if (spentHere) {
    const had = cost[stage] ?? { seconds: 0, input: 0, output: 0, pages: 0 };
    cost[stage] = {
      seconds: Math.round((had.seconds + spentHere.seconds) * 10) / 10,
      input: had.input + spentHere.input,
      output: had.output + spentHere.output,
      pages: had.pages + spentHere.pages,
      // Kept apart from input rather than folded into it: read is billed at a
      // tenth of base and written at one and a quarter times, so a total that
      // mixed them would answer no question anybody has.
      cacheWritten: (had.cacheWritten ?? 0) + (spentHere.cacheWritten ?? 0),
      cacheRead: (had.cacheRead ?? 0) + (spentHere.cacheRead ?? 0),
    };
  }

  // The same stage saying the same thing is the only case that counts as still.
  // A stage change resets it, so checking and fixing alternating during a normal
  // mend is not mistaken for a run that has stalled.
  const said = `${stage} ${progress}`;
  const repeated = watch.saidLast === said;

  return {
    ...watch,
    spent,
    cost,
    saidLast: said,
    saidSame: repeated ? (watch.saidSame ?? 1) + 1 : 1,
  };
}

/**
 * Should this run carry on? Called before each step, so a run that has already
 * gone wrong does not spend money proving it again.
 */
export function check(
  watch: Watch,
  at: { stage: string; startedAt: string | Date; now?: Date },
): Verdict {
  /**
   * Working time, summed from what each stage actually spent.
   *
   * A run with nothing recorded is not judged on time at all. That is the
   * deliberate choice: a run part way through, or one started before this was
   * recorded, has no working time to measure, and "we do not know" must not
   * become "too long". The step caps and the still detector still apply.
   */
  const worked = Object.values(watch.cost ?? {}).reduce((sum, c) => sum + (c?.seconds ?? 0), 0);
  const minutes = worked / 60;

  if (minutes > WORKING_MINUTES) {
    return {
      // No promise about what happens next. It used to say it would carry on
      // from what it already found, and reopening started a brand new run from
      // nothing, so the one sentence an owner was given was untrue.
      say: "This took longer than it should, so we stopped it. Start it again.",
      why: `spent ${minutes.toFixed(1)} minutes working, past the ${WORKING_MINUTES} minute limit, at ${at.stage}`,
    };
  }

  /**
   * Spend, summed the same way as time.
   *
   * Deliberately counts input only. Output is the smaller number and the one
   * we actually want: a run that writes a long card has done its job. Input is
   * where waste hides, because the same evidence pile gets sent again and
   * again by calls that fan out.
   */
  const spentTokens = Object.values(watch.cost ?? {}).reduce((sum, c) => sum + (c?.input ?? 0), 0);
  if (spentTokens > TOKEN_CEILING) {
    return {
      say: "This turned out to be a bigger job than it should be, so we stopped it. Start it again.",
      why: `spent ${spentTokens.toLocaleString()} input tokens, past the ${TOKEN_CEILING.toLocaleString()} ceiling, at ${at.stage}`,
    };
  }

  const cap = CAPS[at.stage];
  const spent = watch.spent?.[at.stage] ?? 0;
  if (cap !== undefined && spent >= cap) {
    return { say: STUCK, why: `${at.stage} took ${spent} steps, the cap is ${cap}` };
  }

  if ((watch.saidSame ?? 0) >= STILL_LIMIT) {
    return {
      say: STUCK,
      why: `${at.stage} repeated the same step ${watch.saidSame} times without moving`,
    };
  }

  return null;
}
