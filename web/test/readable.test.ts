import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sourceOf } from "./tool-source.ts";

/**
 * Can this page be read?
 *
 * Raj, 2026-09-16, looking at the finished comparison: "At present I wouldn't
 * read it." He was right, and the faults map onto Nielsen's usability
 * heuristics almost one for one:
 *
 *   8. Aesthetic and minimalist design. "Interfaces should not contain
 *      information that is irrelevant or rarely needed." Every cell printed
 *      "booksy.com and a date" under its value: thirty repetitions of the same
 *      eight words in one table.
 *   2. Match between the system and the real world. "Use words, phrases, and
 *      concepts familiar to the user, rather than internal jargon." The prose
 *      cited "(page 3)". The reader cannot see page 3.
 *   6. Recognition rather than recall. Comparing two prices meant reading six
 *      sentences and holding them in your head.
 *   4. Consistency and standards. A comparison table should read like one.
 *
 * These are checked on the shapes we ask the model for and on what the screen
 * does with them, because both have to hold for the page to be readable.
 *
 * Source: Nielsen, 10 Usability Heuristics for User Interface Design,
 * nngroup.com/articles/ten-usability-heuristics/
 */

const here = import.meta.dirname;
const stages = sourceOf("competitor-tracker");
const screen = readFileSync(join(here, "..", "app", "workspace", "[tool]", "battlecard.tsx"), "utf8");
const css = readFileSync(join(here, "..", "app", "design.css"), "utf8");

/**
 * The text between two markers, searching for the second one AFTER the first.
 *
 * A plain indexOf for the closing marker finds an earlier occurrence elsewhere
 * in the file, slice() is handed a backwards range, and the test then asserts
 * against an empty string and fails for a reason that has nothing to do with
 * the code. That happened here on the first run.
 */
function between(text: string, from: string, to: string): string {
  const a = text.indexOf(from);
  assert.ok(a >= 0, `"${from}" is not in the file any more`);
  const b = text.indexOf(to, a + from.length);
  assert.ok(b > a, `"${to}" does not appear after "${from}"`);
  return text.slice(a, b);
}

// ---------------------------------------------------------------------------
// A cell holds a value, not a sentence.
// ---------------------------------------------------------------------------

test("a grid cell's value is capped in the schema, not asked for politely", () => {
  // A length asked for in prose is a length that drifts. The cap has to be on
  // the shape, where it is enforced rather than hoped for.
  const cell = stages.slice(stages.indexOf("maxLength: 40") - 400, stages.indexOf("maxLength: 40") + 400);
  assert.match(cell, /maxLength:\s*40/, "a cell value has no length cap");
  assert.match(cell, /Never a sentence/i, "nothing tells it what a value is");
});

test("a cell can carry a qualifier without putting it in the value", () => {
  // Without somewhere for "from" or "under 12s" to go, it ends up inside the
  // value and the column stops being scannable.
  assert.match(stages, /note: \{\s*type: \["string", "null"\],\s*maxLength:\s*80/);
});

test("the two standing columns lead with the finding, not a label", () => {
  // An owner reads the heading and stops, so the heading has to be the answer.
  const win = between(stages, "where_you_win:", "where_they_win:");
  assert.match(win, /maxLength:\s*90/, "the point has no cap, so it becomes a label");
  assert.match(win, /maxLength:\s*160/, "the detail has no cap, so it becomes an essay");
  assert.match(win, /with its number in it/i, "nothing asks for the finding itself");
});

test("nothing is asked to mention a page number", () => {
  // "(page 3)" is our machinery. The reader cannot see page 3 and it means
  // nothing to them. UI/CLAUDE.md section 7 rule 7.
  // Anchored on the actions block, since "rank" left the schema when the
  // ranking moved into our own code.
  const win = between(stages, "where_you_win:", "Exactly three. Order does not matter");
  assert.match(win, /Never mention pages or page numbers/i);
});

// ---------------------------------------------------------------------------
// The same thing is not said thirty times.
// ---------------------------------------------------------------------------

test("a cell does not print its source under every value", () => {
  // The whole reason the table could not be read. It is said once per column
  // now, under the business it belongs to.
  const table = between(screen, '<table className="grid">', "</table>");
  assert.doesNotMatch(
    table,
    /<td[\s\S]*?day\(cell\.source\.fetchedOn\)/,
    "every cell is printing its source and date again",
  );
});

test("a column says where its facts came from, once", () => {
  // Moved, not removed. A claim nobody can check is a claim nobody believes.
  assert.match(screen, /grid__from/, "nothing tells the reader where a column came from");
  assert.match(screen, /usual\[i\]/, "the column's usual source is not worked out");
});

test("a cell speaks up only when its source is not the column's", () => {
  // Otherwise moving the source to the header would quietly lose the exception.
  assert.match(screen, /from !== usual\[i\]/, "an odd source would pass unmentioned");
});

// ---------------------------------------------------------------------------
// A row can be read across.
// ---------------------------------------------------------------------------

test("prices line up digit under digit", () => {
  // Proportional digits make a column of prices impossible to scan: the pounds
  // do not sit above the pounds.
  assert.match(css, /\.grid__value[\s\S]*?font-variant-numeric:\s*tabular-nums/);
});

test("the value is the loudest thing in a cell", () => {
  // If the qualifier or the source can compete with it, the row stops being
  // readable across, which is the only thing a comparison row is for.
  const value = between(css, ".grid__value", ".grid__qual");
  const qual = between(css, ".grid__qual", ".grid__from");
  assert.match(value, /font-weight:\s*600/);
  assert.match(qual, /color:\s*var\(--muted\)/);
  assert.match(qual, /--t-micro/);
});

test("every column is the same width, so no business looks more important", () => {
  assert.match(css, /\.grid \{ table-layout: fixed; \}/);
});

// ---------------------------------------------------------------------------
// The waiting screen. Added 2026-09-16.
// ---------------------------------------------------------------------------

const waitingSrc = readFileSync(join(here, "..", "app", "workspace", "[tool]", "running.tsx"), "utf8");

/**
 * The file with its comments removed and its line wraps flattened.
 *
 * Both of these caught me out writing the tests below. A comment explaining
 * what a message used to say still contains that message, so a check for the
 * old wording fired on the note explaining why it went. And a sentence wrapped
 * across two lines does not match a regex written as one sentence.
 */
const waiting = waitingSrc
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/\s+/g, " ");

test("nothing on the waiting screen predicts how long is left", () => {
  /**
   * It said "About a minute to go" for the first ninety seconds of a run that
   * takes about three, then "Nearly there" for the rest. Both hardcoded,
   * neither true. UI/CLAUDE.md section 7 rule 7: a status claim about our own
   * work is the easiest false statement in the product to write, because
   * nobody can check it.
   */
  assert.doesNotMatch(waiting, /About a minute to go|Nearly there|to go</i);
  assert.match(waiting, /Running for/, "nothing tells the reader it is still alive");
});

test("the clock is read on the client, never while rendering", () => {
  // Reading Date.now() during render puts one second in the server's HTML and
  // the next in the client's, and React refuses the mismatch. It is the
  // textbook hydration fault and it reached the screen once.
  assert.doesNotMatch(waitingSrc, /const since = Math\.round\(\(Date\.now\(\)/);
  assert.match(waiting, /useEffect\(\(\) => \{ setNow\(Date\.now\(\)\)/);
  assert.match(waiting, /now !== null && <span/, "the elapsed line renders before the clock is read");
});

test("the first screen says what it will do and roughly how long", () => {
  // The reader is deciding whether to wait, so that is the question to answer.
  //
  // These three lines used to be asserted against running.tsx, which is shared
  // by every tool, so the assertion was really "the shared screen describes the
  // Competitor Tracker's work" — which it did, for whatever was running. The
  // copy now lives with the tool that means it, and so does the assertion.
  const tracker = readFileSync(
    join(here, "..", "app", "workspace", "[tool]", "competitor-tracker.tsx"),
    "utf8",
  );
  assert.match(tracker, /up to five competitors/i);
  assert.match(tracker, /about three minutes/i);
  assert.match(tracker, /comes off a page we have read/i, "nothing says why it is worth the wait");
  assert.match(waiting, /\{opening\.doing\}/, "the shared screen no longer shows an opening at all");
});

test("the running screen shows the real progress line, not a fixed word", () => {
  /**
   * "Found 32 barbers in Shrewsbury" is both proof of life and proof of work.
   *
   * It moved into AgentPulse on 2026-09-18, so the locator is the prop rather
   * than the markup. What is asserted is unchanged: the run's own sentence
   * reaches the screen, and no fixed word stands in for it.
   */
  assert.match(waiting, /<AgentPulse doing=\{progress\}/);
  assert.doesNotMatch(waiting, /doing="[A-Za-z]/, "a fixed word replaced the run's own line");
});

test("no spinner, no skeleton, no percentage", () => {
  /**
   * The handoff replaces all three with the pulse. A skeleton draws a shape
   * that is not there yet, which is a promise about an answer nobody has, and
   * the bars here were doing exactly that under a comment saying they were not
   * a spinner.
   */
  const code = waiting.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  assert.doesNotMatch(code, /className="sk\b|sk--|spinner|shimmer/, "a skeleton is still drawn");
  assert.doesNotMatch(code, /%\s*<\/|progress(bar|Bar)|aria-valuenow/, "a percentage is claimed");
  assert.match(code, /<AgentPulse/, "nothing says an agent is working");
});

// ---------------------------------------------------------------------------
// The summary above the findings. Added 2026-09-16.
// ---------------------------------------------------------------------------

// The whole tool, not scrub.ts by name. What this checks is that the tracker
// drops an unsourced headline rather than rewording it, which is true of the
// tool wherever the function lives. Six tests broke on 2026-09-17 because they
// were pinned to a filename while checking something that had simply moved.
const scrubSrc = sourceOf("competitor-tracker");

test("the page says what it compared before the first finding assumes you know", () => {
  /**
   * The first line an owner read was a finding beginning "You publish 5
   * prices", and nothing had yet said what 5 was or who they were. Raj:
   * "there is no short summary."
   */
  assert.match(screen, /We compared you with \{card\.competitors\.length\}/);
  assert.match(screen, /areasRead/, "the areas compared are not named");
});

test("the orientation line is fixed text, so it cannot be wrong", () => {
  // The headline is written and can be dropped. The line under it is the one
  // that always survives, so it must not depend on anything generated.
  const summary = between(screen, '<div className="summary">', "</div>");
  assert.doesNotMatch(summary, /card\.shortfall|card\.areas|headline\?\./);
  assert.match(summary, /card\.competitors\.length === 1 \? "business" : "businesses"/);
});

test("only the areas actually built are named", () => {
  // Naming an area the run could not produce is the summary promising
  // something the page does not have.
  assert.match(screen, /g\.area === a\.key && g\.rows\.length > 0/);
});

test("the headline is dropped rather than shown when it cannot be stood behind", () => {
  // It is the first line and the most quoted, so it is the worst place on the
  // page for an unprovable claim.
  assert.match(scrubSrc, /export function scrubHeadline/);
  assert.match(scrubSrc, /unsafe\(said\) \?\? \(headline\?\.source \? null : "nothing to point at for it"\)/);
  assert.match(screen, /\{card\.headline && </, "the headline renders even when it was dropped");
});

test("the headline is asked for as a finding, not a summary of the page", () => {
  // Anchored on the description, because an action also has a "headline" key
  // and it comes first in the file.
  // Whitespace flattened, and adjacent string literals joined: a message
  // written as "one half " + "and the other" does not match a regex written as
  // the sentence a reader sees.
  const flat = stages.replace(/\s+/g, " ").replace(/" \+ "/g, "");
  const shape = between(flat, "The single most useful thing on this page", "competitors: BATTLECARD_SHAPE");
  assert.match(shape, /maxLength:\s*120/);
  assert.match(shape, /Never a greeting, never a summary of what the page contains/i);
});

test("the two lists at the foot are the same shape", () => {
  /**
   * Raj, 2026-09-16: "2 tables next to each other look odd. They should have
   * the same format." They are a pair, and two different formats side by side
   * read as two different things.
   *
   * The left one was a table of raw urls, eighty characters each and wrapped
   * over two lines. It also answered the wrong question: the reader wants to
   * know whose page it was, not what its address is.
   */
  const pair = between(screen, '<div className="checked">', "A blank on this page");
  assert.doesNotMatch(pair, /<table>/, "one side is still a table");
  assert.equal((pair.match(/className="cell-list"/g) ?? []).length, 3, "the two sides differ in shape");
});

test("a source is named by whose page it was, with the address underneath", () => {
  assert.match(screen, /\{whose\(s\.url\) \?\? host\(s\.url\)\}/);
  assert.match(screen, /<a href=\{s\.url\}/, "the address cannot be opened and checked");
});

test("whose page it was comes from the grid, so old battlecards work too", () => {
  // Stored alongside the source it would have needed a fresh run to be useful.
  // The grid already pairs a column with the address its fact came from.
  assert.match(screen, /if \(url && g\.columns\?\.\[i\] && !owners\.has\(url\)\)/);
  assert.match(screen, /owners\.get\(url\) \?\? null/);
});

test("the page shows the narrowing, not just what survived it", () => {
  /**
   * Raj, 2026-09-16: "What did we check to understand possible competitors,
   * then narrow down? We must have checked others."
   *
   * It showed the eight pages we read and nothing else. A real run had ran 5
   * searches, looked at 48 results, read 2 town listings and found 32
   * businesses to get to those 8. None of that was on the page, so the reader
   * could not see the work, and the work is most of the reason to believe the
   * answer.
   */
  assert.match(screen, /funnelReads\(card\.funnel\)/);
  const shortfall = sourceOf("competitor-tracker");
  assert.match(shortfall, /export function funnelReads/);
  for (const part of ["searches", "results", "town", "businesses"]) {
    assert.match(shortfall, new RegExp(part), `the narrowing never mentions ${part}`);
  }
});
