import { decideRun, nextRunAt } from "../../Agents/Competitor Tracker/src/freshness.ts";

/**
 * When a tool is allowed to run again.
 *
 * The rule and its edge cases were already written and tested in
 * `Agents/Competitor Tracker/src/freshness.ts`, so this calls that rather than
 * writing "is it seven days" a second time. The Competitor Tracker's own build
 * notes warn about exactly this: the Swap-in box reimplemented `candidate.ts`
 * in inline JavaScript and the two copies contradicted each other within hours.
 *
 * Deciding this is the workspace's job and not the tool's. A tool asked to
 * check whether it is allowed to run is a tool that can forget to.
 */
export { decideRun, nextRunAt };

/** The same answer in words a customer reads, rather than a reason code. */
export function sayWhen(decision: ReturnType<typeof decideRun>): string {
  if (decision.allowed) return "Ready to run";
  if (decision.reason === "clock-went-backwards") {
    return "We cannot tell when this last ran, so it is holding until we can.";
  }
  const when = decision.nextRunAt
    ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" })
        .format(new Date(decision.nextRunAt))
    : "in a week";
  return `We look once a week, so this is the same answer you will see all week. Next check ${when}.`;
}

/**
 * How old an unfinished run may be before it is dead rather than resumable.
 *
 * The same day the scheduled tick uses. `stalled_runs` has refused anything
 * older since the beginning, on the reasoning that a day is generous for a
 * closed laptop and short enough that last week's run stays dead. The screen
 * had no limit at all, so the two disagreed and the browser was the one with
 * no opinion.
 *
 * On 2026-09-17 that put New York on a St Albans owner's screen. A run started
 * at 14:54 the previous day was parked holding 192 businesses read off
 * fresha.com/lp/en/bt/hair-salons/in/us-new-york/st.-albans. The country check
 * that refuses that page was written this morning and works: opening the page
 * resumed the old run instead of starting one, so yesterday's rows walked
 * straight past this morning's fix and arrived as today's findings.
 *
 * A run is state built by code. Resuming one is trusting an answer worked out
 * by a version we may have since corrected, which is exactly what a day-old
 * run cannot be trusted to be.
 */
export const RESUMABLE_HOURS = 24;

/** Too old to carry on, so it is retired and a fresh one is started. */
export function tooOldToResume(startedAt: string | null | undefined, now: Date): boolean {
  if (!startedAt) return false;
  const began = Date.parse(startedAt);
  if (Number.isNaN(began)) return false;   // an unreadable date is not an age
  return now.getTime() - began >= RESUMABLE_HOURS * 3_600_000;
}
