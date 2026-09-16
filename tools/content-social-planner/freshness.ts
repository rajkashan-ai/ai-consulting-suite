import { PLAN_DAYS } from "../../../Agents/Content & Social Planner/src/plan-shape.ts";

/**
 * When a new plan is worth making.
 *
 * Not `tools/cadence.ts`. That one is the Competitor Tracker's rule and the
 * Tracker's words: seven days, and "we look once a week". It sits at the tools
 * root because both tools could in principle share it, and they cannot share
 * this, because a plan covers thirty days. Re-running weekly would throw away
 * three quarters of a month somebody has not posted yet.
 *
 * `PLAN_DAYS` rather than 30, so the number has one home. If the plan ever
 * covers a different span, this follows it.
 */

export type Decision = { allowed: boolean; nextRunAt: string | null };

export function decidePlan(lastPlanAt: string | null, now: Date): Decision {
  if (!lastPlanAt) return { allowed: true, nextRunAt: null };

  const last = new Date(lastPlanAt);
  if (Number.isNaN(last.getTime())) return { allowed: true, nextRunAt: null };

  /**
   * A plan dated in the future is a clock that went backwards, not a plan.
   * Allowing the run is the safe answer: the worst case is one plan nobody
   * needed, against a workspace stuck for a month showing a plan it cannot
   * explain.
   */
  if (last.getTime() > now.getTime()) return { allowed: true, nextRunAt: null };

  const next = new Date(last.getTime() + PLAN_DAYS * 86400000);
  return { allowed: now.getTime() >= next.getTime(), nextRunAt: next.toISOString() };
}

/** The same answer in words the owner reads, rather than a reason code. */
export function sayNext(decision: Decision): string {
  if (decision.allowed || !decision.nextRunAt) return "";
  const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(
    new Date(decision.nextRunAt),
  );
  return `This covers the next ${PLAN_DAYS} days. The next one is ready on ${when}.`;
}
