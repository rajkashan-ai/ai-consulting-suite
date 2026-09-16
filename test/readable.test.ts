import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
const stages = readFileSync(join(here, "..", "tools", "competitor-tracker", "stages.ts"), "utf8");
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
  const win = between(stages, "where_you_win:", "rank: { type: \"integer\" }");
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
