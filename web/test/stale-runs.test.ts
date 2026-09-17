import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RESUMABLE_HOURS, tooOldToResume } from "../tools/cadence.ts";

/**
 * 2026-09-17. A St Albans salon owner opened the app and was offered five
 * competitors in Queens, New York, every one of them pre-ticked.
 *
 * The country check was not broken. It correctly refuses the page those rows
 * came from, fresha.com/lp/en/bt/hair-salons/in/us-new-york/st.-albans, and it
 * was written that morning. The run holding them had started at 14:54 the
 * previous day and was parked. Opening the page resumed it, so rows gathered
 * before the fix walked past it and arrived as findings after it.
 *
 * A run is state built by code. Resuming a day-old one is trusting an answer
 * worked out by a version we may since have corrected.
 */

const screens = ["competitor-tracker", "content-social-planner"];
const read = (name: string) =>
  readFileSync(join(import.meta.dirname, "..", "app", "workspace", "[tool]", `${name}.tsx`), "utf8");

test("a run left overnight is not resumed", () => {
  const overnight = new Date("2026-09-16T14:54:00Z").toISOString();
  assert.equal(tooOldToResume(overnight, new Date("2026-09-17T14:55:00Z")), true, "24 hours and a minute");
  assert.equal(tooOldToResume(overnight, new Date("2026-09-17T02:00:00Z")), false, "11 hours, a closed laptop");
  assert.equal(tooOldToResume(null, new Date()), false);
  // An unreadable date is not an age. Date.parse returns NaN and every NaN
  // comparison is false, which would have made this silently never fire.
  assert.equal(tooOldToResume("not a date", new Date()), false);
});

test("every tool screen retires a stale run rather than carrying it on", () => {
  for (const name of screens) {
    const src = read(name);
    assert.match(src, /tooOldToResume\(latest\.started_at, new Date\(\)\)/, name);
    // Retired, not ignored: one run at a time per workspace is a database
    // constraint, so leaving it unfinished blocks the fresh one and the screen
    // would show nothing at all.
    assert.match(src, /stage: "failed"/, `${name} ignores the stale run instead of retiring it`);
  }
});

test("the screen and the scheduler agree on how old is too old", () => {
  /**
   * They disagreed, and the browser was the one with no opinion: stalled_runs
   * has refused anything over a day since the beginning, while the screen
   * resumed a run of any age.
   */
  const sql = readFileSync(
    join(import.meta.dirname, "..", "supabase", "competitor-tracker-2026-09-17-waiting-runs.sql"),
    "utf8",
  );
  const hours = /interval '(\d+) hours'/.exec(sql);
  assert.ok(hours, "the tick no longer has an age limit");
  assert.equal(
    Number(hours![1]),
    RESUMABLE_HOURS,
    "the screen and the scheduled tick disagree about how old a run may be",
  );
});

test("the measuring script does not share the defect it is meant to catch", () => {
  /**
   * How this was missed. scripts/time-a-run.ts resumed an unfinished run of any
   * age, exactly like the screens did, so every measurement taken on the
   * morning of 2026-09-17 would have shown New York had it been pointed at the
   * workspace holding the stale run. It never was: every run that day was
   * against one of the two St Albans rows, and the stale one sat on the other.
   *
   * A harness that shares a fault with the product cannot find that fault. It
   * reproduces it and reports it as the product working.
   */
  const driver = readFileSync(
    join(import.meta.dirname, "..", "scripts", "time-a-run.ts"),
    "utf8",
  );
  assert.match(
    driver,
    /tooOldToResume\(run\.started_at, new Date\(\)\)/,
    "the harness resumes a run of any age, so it cannot see a stale one",
  );
  assert.match(driver, /started_at/, "it does not even read the field the check needs");
});
