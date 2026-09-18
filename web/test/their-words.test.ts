/**
 * Their own prose, voice and cadence, kept.
 *
 * The rule Raj set on 2026-09-18: output must strictly preserve the user's raw
 * prose, voice and cadence, without summaries, rewrites or manufactured
 * conclusions.
 *
 * Both places that took the owner's raw text ran `.replace(/\s+/g, " ")`, which
 * collapses newlines along with spaces, so the shape they typed was gone before
 * anything read it. We then asked the writer to sound like them.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { asNotes, asTheyTypedIt, asThought } from "../tools/content-social-planner/paths.ts";
import { sourceOf } from "./tool-source.ts";

const THEIRS = "Balayage, £95\nBook two weeks ahead\nAsk for Sarah";

test("the lines they typed are still lines", () => {
  assert.equal(asTheyTypedIt(THEIRS), THEIRS);
  assert.equal(asNotes(THEIRS), THEIRS);
  const said = asThought(THEIRS);
  assert.ok("text" in said && said.text === THEIRS, "their shape was flattened");
});

test("a paragraph break survives, and a wall of blank lines does not", () => {
  assert.equal(asTheyTypedIt("One thing.\n\nAnother thing."), "One thing.\n\nAnother thing.");
  assert.equal(asTheyTypedIt("One.\n\n\n\n\nTwo."), "One.\n\nTwo.");
});

test("runs of spaces still collapse, because the length guards depend on it", () => {
  /* "a" then eleven spaces then "b" is not thirteen characters of thought.
     That is the case the button and the guard once disagreed about. */
  assert.equal(asTheyTypedIt("a" + " ".repeat(11) + "b"), "a b");
  assert.ok("error" in asThought("a" + " ".repeat(11) + "b"));
});

test("nothing else of theirs is touched", () => {
  /* Not their capitals, not their punctuation, not their spelling, not a full
     stop they left off. Tidying any of it is rewriting them. */
  const rough = "bride in at 6am.. had her in the chair b4 we opened!! best one all week";
  assert.equal(asTheyTypedIt(rough), rough);
  assert.equal(asNotes(rough), rough);
});

test("trailing and leading space goes, and only that", () => {
  assert.equal(asTheyTypedIt("   Balayage, £95   "), "Balayage, £95");
  assert.equal(asTheyTypedIt("Line one   \n   Line two"), "Line one\nLine two");
});

test("carriage returns from a paste do not become extra blank lines", () => {
  /* Pasting from Notes or Word brings \r\n. Left alone it doubles every gap. */
  assert.equal(asTheyTypedIt("One\r\nTwo\r\n\r\nThree"), "One\nTwo\n\nThree");
});

test("the writer is told their words are theirs", () => {
  const rules = sourceOf("content-social-planner");
  assert.match(rules, /exactly as they typed them/i);
  assert.match(rules, /never tidy their phrasing/i);
  assert.match(rules, /the part that is theirs stays rough/i);
});
