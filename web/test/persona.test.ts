import test from "node:test";
import assert from "node:assert/strict";
import {
  SAMPLES_MAX,
  SAMPLE_MIN,
  STYLES,
  STYLE_RULES,
  asInspiration,
  asSamples,
  isStyle,
  styleById,
} from "../tools/content-social-planner/persona.ts";

/**
 * Brand Persona, 2026-09-17. It was two sentences of prose read off a website,
 * shown near the bottom and used quietly. A website is often written by whoever
 * built it in 2019; their own posts are how they actually talk.
 */

test("five ways to sound, and the way back", () => {
  assert.equal(STYLES.length, 6, "five styles and the original");
  assert.equal(STYLES[0].id, "original", "their own voice is listed first, as the way out");
  assert.deepEqual(
    STYLES.map((s) => s.id),
    ["original", "expert", "warm", "direct", "uplifting", "story"],
  );
  // Each says what it sounds like rather than naming an adjective. "Warm" is a
  // word every business would claim about itself.
  for (const s of STYLES) {
    assert.ok(s.sounds.length > 40, `${s.id} describes itself in too few words to choose by`);
    assert.ok(s.suits.length > 20, `${s.id} does not say who it is for`);
  }
});

test("the owner is told a feeling and the writer is told a rule", () => {
  /**
   * A model given "warm and approachable" writes a pastiche of warmth. It gets
   * sentence length, contractions and what never to reach for instead.
   *
   * Two audiences, two texts. The same failure as telling the guard which
   * prices are real and not telling the writer, which cost a run today.
   */
  for (const s of STYLES) {
    if (s.id === "original") continue;
    const rule = STYLE_RULES[s.id];
    assert.ok(rule && rule.length > 80, `${s.id} has no instruction for the writer`);
    assert.notEqual(rule, s.sounds, `${s.id} tells the writer what it tells the owner`);
  }
  // And the original has no rule, because it is not a style: it is what we read.
  assert.equal("original" in STYLE_RULES, false);
});

test("a style is chosen by id, never by label", () => {
  assert.equal(isStyle("warm"), true);
  assert.equal(isStyle("Warm and conversational"), false);
  assert.equal(isStyle("friendly"), false);
  assert.equal(isStyle(null), false);
  assert.equal(styleById("direct").label, "Direct and no-nonsense");
});

test("pasted posts are their own words, taken as given", () => {
  const two = "A short caption about a wedding we did on Saturday, hair up, six in the party.\n\n" +
    "Another caption, this one about the new colour line we brought in last month.";
  assert.equal(asSamples(two).length, 2);

  // Too short to show a pattern, or long enough to be a whole page.
  assert.deepEqual(asSamples("too short"), []);
  assert.deepEqual(asSamples("x".repeat(2_000)), []);
  assert.deepEqual(asSamples(null), []);

  // Three is enough to see a pattern; more is the same pattern again.
  const many = Array.from({ length: 9 }, (_, i) => `${"Caption number " + i} `.repeat(6)).join("\n\n");
  assert.equal(asSamples(many).length, SAMPLES_MAX);

  // The same caption pasted twice is one sample.
  const twice = `${"A caption long enough to count as a sample of how they write. "}`;
  assert.equal(asSamples(`${twice}\n\n${twice}`).length, 1);
  assert.ok(SAMPLE_MIN >= 40);
});

test("an inspiration we are not allowed to read is refused with the reason", () => {
  /**
   * Checked, not assumed: instagram.com and facebook.com both answer
   * "Their robots.txt asks us not to read this page." Rule 1.5 says a block is
   * the gate, never an obstacle, so this is refused here with a sentence
   * rather than fetched and quietly failing.
   */
  for (const handle of [
    "https://www.instagram.com/someonegood/",
    "instagram.com/someonegood",
    "https://facebook.com/someonegood",
    "https://www.tiktok.com/@someonegood",
  ]) {
    const got = asInspiration(handle);
    assert.ok(got && "error" in got, handle);
    assert.match(got.error, /asks us not to read it/);
    assert.doesNotMatch(got.error, /robots|403|null|blocked list/i, "our machinery reached the screen");
  }

  // A website or a blog is fine, with or without the scheme.
  assert.deepEqual(asInspiration("https://someonegood.co.uk"), { url: "https://someonegood.co.uk" });
  assert.deepEqual(asInspiration("someonegood.co.uk/about"), { url: "https://someonegood.co.uk/about" });

  // Optional means optional: nothing entered is not an error.
  assert.equal(asInspiration(""), null);
  assert.equal(asInspiration(null), null);
  assert.ok("error" in asInspiration("not a web address")!);
});
