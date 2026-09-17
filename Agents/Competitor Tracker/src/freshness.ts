/**
 * Once a week, never more. CLAUDE.md section 2a.
 *
 * This is three rules in one function. It is the cost control, because a
 * fetch-heavy run on every visit is the thing that makes a flat price
 * unprofitable. It is the honesty control, because the same question should not
 * give different answers on Tuesday and Thursday. And it is what makes "what
 * changed since last week" mean anything.
 */

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type RunDecision =
  | { allowed: true; reason: 'never-run' | 'week-elapsed' }
  | { allowed: false; reason: 'within-the-week' | 'clock-went-backwards'; nextRunAt: string };

export function decideRun(lastRunAt: string | null, now: Date): RunDecision {
  if (lastRunAt === null) return { allowed: true, reason: 'never-run' };

  const last = new Date(lastRunAt).getTime();
  const elapsed = now.getTime() - last;
  const nextRunAt = new Date(last + WEEK_MS).toISOString();

  // A clock that has gone backwards is either skew or someone supplying their
  // own. Either way it is not seven days, so it does not buy a fresh run.
  if (elapsed < 0) return { allowed: false, reason: 'clock-went-backwards', nextRunAt };
  if (elapsed < WEEK_MS) return { allowed: false, reason: 'within-the-week', nextRunAt };
  return { allowed: true, reason: 'week-elapsed' };
}

export function nextRunAt(lastRunAt: string): string {
  return new Date(new Date(lastRunAt).getTime() + WEEK_MS).toISOString();
}

/**
 * Changing the competitor list rebuilds the table and the actions from data we
 * already hold. It does not buy a trip to the web inside the week.
 */
export function changingTheListTriggers(lastRunAt: string | null, now: Date) {
  return {
    recomputeFromStored: true,
    fetchFreshFromWeb: decideRun(lastRunAt, now).allowed,
  };
}
