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

  /**
   * The step running right now: which stage, and when it was claimed.
   *
   * Written before the work starts and cleared when the step saves. A step that
   * is killed mid-flight saves nothing, so it leaves this behind, and this is
   * the only thing that sees it. Every other measurement we keep is written at
   * the end of a step, which means a step that never ends is invisible to all
   * of them: the token ceiling, the worked-seconds clock, the progress line.
   */
  began?: { stage: string; at: string } | null;

  /**
   * Steps that started and never finished, and how long they had been going
   * when the next claim noticed. An empty list here is the evidence that steps
   * are completing; a full one is the evidence that they are not.
   */
  died?: { stage: string; seconds: number }[];
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
export const TOKEN_CEILING = 300_000;

/**
 * Counted as billed, which is why this is not the number it was.
 *
 * It was 150,000 measured against `input` alone. Two things then changed and
 * they pull the same way:
 *
 *   1. `billed()` now counts cache writes at 1.25 and reads at 0.1, so the
 *      same successful run reads as 145,980 rather than 87,274.
 *   2. A run using the picker also looks up a page for each business the owner
 *      chose, at about 13,500 a search, five at most.
 *
 * So a full picker run is about 146,000 plus 67,500, call it 214,000. The old
 * ceiling would have stopped every one of them at the last stage with the work
 * already done, which is exactly how three runs died on 2026-09-17.
 *
 * 300,000 leaves room for the spread and none for the failure this exists to
 * catch: the worst real run reached 434,033 input tokens alone.
 *
 * The lookup figure is an estimate and the rest are measurements. Revisit once
 * three runs have gone through `finding`. Raising a limit on arithmetic is a
 * thing to be uncomfortable about, which is why the arithmetic is here rather
 * than in a commit message nobody reads twice.
 */

/** Kept for anything still reading the old name. */
export const WHOLE_RUN_MINUTES = WORKING_MINUTES;

/** Identical steps in a row before we call it still. */
export const STILL_LIMIT = 3;

/**
 * Stages that are waiting for the customer, not working.
 *
 * Named here rather than in the tool, because the watchdog is what would kill
 * them and a rule belongs where it is enforced. A tool adding a stage that
 * waits has to say so here, which is a deliberate speed bump: a stage nobody
 * declared is treated as work, and work that repeats is a fault.
 */
export const WAITING_ON_A_PERSON = new Set(["picking"]);

/**
 * What one stage may spend before it is stopped on its own.
 *
 * The whole-run ceiling only notices after the damage, when a run is already
 * past it and every earlier stage has been paid for. A per-stage budget stops
 * the stage that is actually misbehaving, which is what Raj asked for: abort
 * that stage rather than loop.
 *
 * Every number is the measured cost of that stage times two, so a stage has to
 * be doing something genuinely different to trip it, not merely having a slow
 * day. Measured 2026-09-17, billed, on the runs that finished:
 *
 *   searching   69,364    listings  16,802
 *   writing     60,000    finding   67,500 (estimated, 5 lookups)
 *
 * A stage with no entry is not budgeted: choosing and picking spend nothing,
 * and inventing a limit for them would be inventing a fact.
 */
export const STAGE_TOKENS: Record<string, number> = {
  searching: 140_000,
  listings: 35_000,
  finding: 140_000,
  writing: 120_000,
};

/**
 * How long one step may take before it is stopped.
 *
 * Raj asked for 60 seconds. Measured, that would abort a stage that works: the
 * writing step took 65.3 and 68.6 seconds on the two runs that finished, and
 * the listings step 50.9. So 60 is below the floor rather than above the
 * ceiling, and setting it there would stop the product working while looking
 * like a safety measure.
 *
 * 120 is twice the slowest step that has ever succeeded. A step over that is
 * doing something no successful run has done.
 */
export const STEP_SECONDS = 120;

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
  /**
   * One search each for the five they chose, plus one spare step to notice
   * there are none left. A stage that searches is a stage that spends, so this
   * one is capped tightly rather than loosely.
   */
  finding: 6,
  searching: 3,
  /**
   * One page per step now, so this is MOST_TRIES plus the step that finds
   * there are none left.
   *
   * It was 4, set when the stage read every listing page in a single step. The
   * split on 2026-09-17 made it one page a step and left this behind, so a town
   * with five listings would have been stopped as "circling" while it was
   * working exactly as intended. Found by a test fixture, not by a run.
   */
  listings: 7,
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
 * What a run has actually cost, in base-input units.
 *
 * Not the same as the input tokens it was charged for, and the difference is
 * most of the bill. A cache write is 1.25 times base input and a cache read is
 * a tenth, so a run that moves its evidence into the cache moves it out of
 * `input` at the same time.
 *
 * Measured on 2026-09-17, after caching was turned on:
 *   0699ede3  input 81,442  written 21,015  read 17,641  ->  109,475
 *   a66b85d2  input 87,274  written 43,736  read 40,362  ->  145,980
 *
 * The ceiling was reading the first column. On a66b85d2 it believed the run
 * had spent 87,274 while the real figure was about 146,000, a 67 per cent
 * undercount, and the gap arrived with the caching fix: the same evidence
 * simply moved somewhere the guard was not looking. A limit that cannot see
 * two thirds of the spend is not a limit.
 */
export function billed(watch: Watch): number {
  return Math.round(
    Object.values(watch.cost ?? {}).reduce(
      (sum, c) => sum + (c?.input ?? 0) + (c?.cacheWritten ?? 0) * 1.25 + (c?.cacheRead ?? 0) * 0.1,
      0,
    ),
  );
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
  const spentTokens = billed(watch);
  if (spentTokens > TOKEN_CEILING) {
    return {
      say: "This turned out to be a bigger job than it should be, so we stopped it. Start it again.",
      why: `spent ${spentTokens.toLocaleString()} input tokens, past the ${TOKEN_CEILING.toLocaleString()} ceiling, at ${at.stage}`,
    };
  }

  /**
   * A stage that is waiting on a person is not a stage that is stuck.
   *
   * Both nets below measure repetition: the same step several times, or a stage
   * taking more steps than it should. A run parked waiting for the owner to say
   * who their competitors are repeats deliberately and for as long as it takes,
   * and would be killed within three ticks by rules written for a run going
   * round in circles.
   *
   * Exempted from those two only. Time and money still apply, and a waiting
   * step spends neither, so a run cannot hide here: it makes no model call and
   * reads no page, which is what makes waiting affordable in the first place.
   */
  if (WAITING_ON_A_PERSON.has(at.stage)) return null;

  /**
   * This stage, on its own, rather than the run as a whole.
   *
   * Checked before the cap below, because "searching has spent 140,000 tokens"
   * is a more useful thing to know than "searching has taken four steps", and
   * because a stage can blow a budget in one step.
   */
  const budget = STAGE_TOKENS[at.stage];
  const here = watch.cost?.[at.stage];
  if (budget !== undefined && here) {
    const spentHere = Math.round(
      (here.input ?? 0) + (here.cacheWritten ?? 0) * 1.25 + (here.cacheRead ?? 0) * 0.1,
    );
    if (spentHere > budget) {
      return {
        say: "One part of this turned out far bigger than it should be, so we stopped. Start it again.",
        why: `${at.stage} spent ${spentHere.toLocaleString()} against its ${budget.toLocaleString()} budget`,
      };
    }
    if ((here.seconds ?? 0) / Math.max(1, watch.spent?.[at.stage] ?? 1) > STEP_SECONDS) {
      return {
        say: "One part of this is taking far longer than it should, so we stopped. Start it again.",
        why: `${at.stage} averaged over ${STEP_SECONDS}s a step, across ${watch.spent?.[at.stage]} steps`,
      };
    }
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
