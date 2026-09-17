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
