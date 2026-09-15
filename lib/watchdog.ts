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
};

/**
 * `say` goes to the customer. `why` is for us, and is kept in the run's state
 * rather than shown, because a customer reading "stuck at stage checking" has
 * been told about our machinery and still cannot do anything with it.
 */
export type Verdict = { say: string; why: string } | null;

/** The whole run, end to end. A good run is around six minutes. */
export const WHOLE_RUN_MINUTES = 12;

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

/** Record one completed step. Returns the updated record, nothing mutated. */
export function note(watch: Watch, stage: string, progress: string): Watch {
  const spent = { ...(watch.spent ?? {}) };
  spent[stage] = (spent[stage] ?? 0) + 1;

  // The same stage saying the same thing is the only case that counts as still.
  // A stage change resets it, so checking and fixing alternating during a normal
  // mend is not mistaken for a run that has stalled.
  const said = `${stage} ${progress}`;
  const repeated = watch.saidLast === said;

  return {
    ...watch,
    spent,
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
  const now = at.now ?? new Date();
  const started = new Date(at.startedAt);

  // An unreadable start date must not be taken as "started in 1970" and fail
  // every run on sight.
  if (!Number.isNaN(started.getTime())) {
    const minutes = (now.getTime() - started.getTime()) / 60_000;
    if (minutes > WHOLE_RUN_MINUTES) {
      return {
        say: "This took longer than it should, so we stopped it. Start it again and it will carry on from what it already found.",
        why: `ran ${minutes.toFixed(1)} minutes, past the ${WHOLE_RUN_MINUTES} minute limit, at ${at.stage}`,
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
