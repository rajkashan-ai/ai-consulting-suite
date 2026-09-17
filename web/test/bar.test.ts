import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { belowTheBar, givesSomethingAway, longestSentence, sayBar, LONGEST_SENTENCE } from "../tools/content-social-planner/bar.ts";
import type { KnownFacts } from "../../Agents/Content & Social Planner/src/types.ts";
import { specOf } from "./tool-source.ts";

/**
 * The bar is somebody else's, and it is checked.
 *
 * Raj, 2026-09-16: whoever sets the bar sets it for everything we write, and it
 * is not this tool's judgement. So every check names the person whose rule it
 * is, and a check with no name attached is this tool's taste wearing a rule's
 * clothes, which is worse than no check because it is invisible.
 */

const KNOWN: KnownFacts = {
  services: ["clipper cut", "beard trim"],
  prices: { "clipper cut": "£8" },
  accreditations: [], awards: [], namedClients: [], counts: {},
  reviewThemes: [], servesAnArea: true,
};

const post = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    date: "2026-09-17", week: 1, channel: "instagram", angle: "what-it-costs", purpose: "useful",
    words: "A clipper cut is £8 and takes about twenty minutes.",
    shot: "The price list on the wall.", why: "They ask.", source: { url: "u", fetchedOn: "d" },
    ...over,
  }) as never;

test("every rule carries the name of whoever set it", () => {
  const bad = belowTheBar(post({ words: "We are the best around. Come and see us soon." }), KNOWN);
  assert.ok(bad.length, "nothing was caught at all");
  for (const p of bad) {
    assert.ok(p.whose.length > 5, "a rule with nobody behind it is our own taste");
    assert.match(p.whose, /Baer|Handley|Vaynerchuk/, `who is ${p.whose}?`);
    assert.ok(p.rule.length > 10, `${p.whose} has no rule written next to them`);
  }
});

test("a useful post that gives nothing away is refused (Baer)", () => {
  const empty = post({ words: "We are the best barbers around and we would love to see you soon." });
  assert.equal(givesSomethingAway(empty, KNOWN), false);
  const [first] = belowTheBar(empty, KNOWN);
  assert.match(first.whose, /Baer/);
  assert.match(first.why, /without booking/);
});

test("a price, a time, a phone number, a postcode or their own service all count", () => {
  for (const words of [
    "A clipper cut is £8.",
    "We open at 8:45 on a Monday.",
    "Ring 01743 362638 and we will find you a slot.",
    "You will find us at SY1 1PW.",
    "A beard trim takes about fifteen minutes.",
  ]) {
    assert.equal(givesSomethingAway(post({ words }), KNOWN), true, `nothing usable found in: ${words}`);
  }
});

test("the ask is allowed to give nothing away, because that is what an ask is", () => {
  const ask = post({ purpose: "offer", angle: "the-ask", words: "Chairs free this week. Come and see us." });
  assert.deepEqual(belowTheBar(ask, KNOWN), [], "an offer was judged as if it were a useful post");
});

test("a sentence nobody would say out loud is refused (Handley)", () => {
  const long = Array.from({ length: LONGEST_SENTENCE + 10 }, (_, i) => `word${i}`).join(" ") + ".";
  assert.ok(longestSentence(long) > LONGEST_SENTENCE);
  const [first] = belowTheBar(post({ words: `A clipper cut is £8. ${long}` }), KNOWN);
  assert.match(first.whose, /Handley/);
});

test("an ordinary post is not refused for being made of sentences", () => {
  const ordinary = post({
    words:
      "A clipper cut is £8 and takes about twenty minutes. We are appointment only, " +
      "so ring ahead and we will find you a slot that suits.",
  });
  assert.deepEqual(belowTheBar(ordinary, KNOWN), [], "a normal post was refused");
});

test("a post too long for the channel it is going on is refused (Vaynerchuk)", () => {
  const huge = post({ words: "A clipper cut is £8. " + "x".repeat(3000) });
  const [first] = belowTheBar(huge, KNOWN);
  assert.match(first.whose, /Vaynerchuk/);
  assert.match(first.why, /Instagram takes/);
});

test("what the owner is told names no book, no person and no rule of ours", () => {
  for (const words of ["We are simply the best.", "A clipper cut is £8. " + "x".repeat(3000)]) {
    for (const p of belowTheBar(post({ words }), KNOWN)) {
      const said = sayBar(p);
      for (const ours of ["Baer", "Handley", "Vaynerchuk", "Youtility", "rule", "bar", "guard", "check"]) {
        assert.doesNotMatch(said, new RegExp(ours, "i"), `machinery reached the owner: "${said}"`);
      }
    }
  }
});

/* ── the mandate, and what actually holds it ──────────────────────────────── */

const spec = specOf("Content & Social Planner");

test("the spec says who sets the bar, by name", () => {
  for (const who of ["Jay Baer", "Ann Handley", "Gary Vaynerchuk"]) {
    assert.ok(spec.includes(who), `${who} sets a rule in the code and is not named in the spec`);
  }
});

test("the spec puts measured evidence above the named bar, and our taste nowhere", () => {
  /* Whitespace-flattened: the spec is wrapped prose and a line break lands
     wherever the paragraph puts it, so matching across one would be matching
     the wrapping rather than the words. */
  const flat = spec.replace(/\s+/g, " ");
  assert.match(flat, /Measured evidence about this business\*\* beats everything/i);
  assert.match(flat, /This tool's judgement\.\*\* Never\./i, "nothing says our own taste is not a rule");
  assert.ok(
    flat.indexOf("Measured evidence") < flat.indexOf("This tool's judgement"),
    "our taste is listed above the evidence",
  );
});

test("the code names whose rule each check is, not just the spec", () => {
  const bar = readFileSync(
    join(import.meta.dirname, "..", "tools", "content-social-planner", "bar.ts"),
    "utf8",
  );
  const whose = [...bar.matchAll(/whose:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(whose.length >= 3, `only ${whose.length} checks name anyone`);
  for (const w of whose) {
    assert.match(w, /Baer|Handley|Vaynerchuk/, `"${w}" is not one of the three the spec names`);
  }
});

test("the evidence that will override the default carries its own evidence", () => {
  /**
   * The loop Raj asked for runs on `learning.ts`, which already refuses a
   * learning with nothing behind it. Asserted here because the mandate is only
   * worth anything if the thing that overrides it is held to the same standard:
   * an unevidenced learning beating a named author would be our taste again,
   * one step removed.
   */
  const learning = readFileSync(
    join(import.meta.dirname, "..", "..", "Agents", "Content & Social Planner", "src", "learning.ts"),
    "utf8",
  );
  assert.match(learning, /export function findUnevidencedLearnings/);
  assert.match(learning, /export function findRepeatedLearnings/);
});
