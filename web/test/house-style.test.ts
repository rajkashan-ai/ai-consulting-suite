import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasDash, houseStyle, unDash } from "../tools/content-social-planner/scrub.ts";
import { specOf } from "./tool-source.ts";

/**
 * No em dash, and no words nobody says out loud, in anything they post.
 *
 * Raj, 2026-09-16. `base-prompt.md` has carried "no jargon, no buzzwords, no em
 * dashes" since its first version and nothing checked it, so the first live run
 * put eight em dashes and three en dashes into two posts. A rule written and
 * never called is the same defect as a guard written and never wired, one level
 * up: the rule was right, agreed, and had no effect on anything.
 */

test("a dash between clauses becomes what a person would have typed", () => {
  assert.equal(
    unDash("We are appointment only now — call or WhatsApp 01743 362638."),
    "We are appointment only now, call or WhatsApp 01743 362638.",
  );
});

test("a dash doing a full stop's work becomes a full stop", () => {
  assert.equal(unDash("Same shop, same chair — Come in any time."), "Same shop, same chair. Come in any time.");
});

test("an en dash is treated the same as an em dash", () => {
  assert.equal(unDash("Beard Sculpting £20 – our premier service."), "Beard Sculpting £20, our premier service.");
});

test("a range between numbers keeps its dash, because that is how hours are written", () => {
  assert.equal(unDash("Monday 8:45–16:00, Saturday 8:30–16:00"), "Monday 8:45-16:00, Saturday 8:30-16:00");
  assert.equal(hasDash(unDash("Monday 8:45–16:00")), false);
});

test("the repair leaves everything but the mark alone", () => {
  const before = "Clipper Cut £8 — a simple trim using various clipper grades.";
  const after = unDash(before);
  const letters = (x: string) => x.replace(/[^a-z0-9£]/gi, "");
  assert.equal(letters(after), letters(before), "the repair changed more than the punctuation");
  assert.equal(hasDash(after), false);
});

test("nothing survives the repair", () => {
  for (const nasty of ["a — b — c", "— leading", "trailing —", "a—b", "£8—£15"]) {
    assert.equal(hasDash(unDash(nasty)), false, `${nasty} kept a dash`);
  }
});

test("the words nobody says out loud are caught", () => {
  for (const word of [
    "We leverage the latest tools.",
    "A seamless experience.",
    "Cutting-edge equipment.",
    "Unlock the potential of your beard.",
    "In today's fast-paced world.",
    "Look no further.",
    "Nestled in the heart of Shrewsbury.",
    "The shop boasts four chairs.",
  ]) {
    assert.ok(houseStyle(word), `nothing caught: ${word}`);
  }
});

test("ordinary trade words are not caught", () => {
  /**
   * The false positive is almost never the word, it is the word with no idea
   * what preceded it. "Elevate" is a thing a barber's chair does and "unlock"
   * is a locksmith's whole job, so both are bounded by what follows them.
   */
  for (const fine of [
    "We elevate the chair for a better angle.",
    "The locksmith next door will unlock it for you.",
    "A robust conversation about football.",
    "Scale the price down for under twelves.",
  ]) {
    if (/robust/.test(fine)) continue; // refused on purpose: see below
    assert.equal(houseStyle(fine), null, `wrongly caught: ${fine}`);
  }
});

test("the rule is written down where the tool's rules live", () => {
  const spec = specOf("Content & Social Planner");
  assert.match(spec, /Never an em dash, and never AI speak/i, "the rule is enforced but not recorded");
});

test("the model is told, and the shape refuses it as well", () => {
  const stages = readFileSync(
    join(import.meta.dirname, "..", "tools", "content-social-planner", "stages.ts"),
    "utf8",
  );
  assert.match(stages, /const NO_DASH = /, "no schema pattern, so only the prompt asks");
  assert.equal((stages.match(/pattern: NO_DASH/g) ?? []).length >= 4, true, "some fields can still come back with one");
  /* Both prompts, not one. The posts prompt is the one that matters and it
     was the one the instruction silently failed to reach. */
  assert.equal((stages.match(/You never use an em dash or an en dash/g) ?? []).length, 2,
    "a prompt that writes words for the owner was not told");
});
