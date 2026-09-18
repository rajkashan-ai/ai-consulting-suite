import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sourceOf } from "./tool-source.ts";
import {
  SAMPLES_MAX,
  SAMPLE_MIN,
  STYLES,
  STYLE_RULES,
  asInspiration,
  asSamples,
  isStyle,
  personaFor,
  styleById,
  type Persona,
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

// ---------------------------------------------------------------------------
// The voice they chose has to reach the writing
// ---------------------------------------------------------------------------

const read = (p: string[]) => readFileSync(join(import.meta.dirname, "..", ...p), "utf8");

test("what the writers are given says the habits and the choice", () => {
  const persona: Persona = {
    tone: "Warm and unhurried.",
    uses: ["pop in", "sorted", "just ask"],
    avoids: ["bespoke", "utilise"],
    style: "Short sentences, says you and we, a line between thoughts.",
    chosen: "original",
  };

  const asRead = personaFor(persona, "original");
  assert.match(asRead, /Warm and unhurried/);
  assert.match(asRead, /pop in, sorted, just ask/);
  assert.match(asRead, /bespoke, utilise/);
  // Their own voice adds no instruction: it is not a style, it is what we read.
  assert.doesNotMatch(asRead, /Write in this voice/);

  const asChosen = personaFor(persona, "direct");
  assert.match(asChosen, /Write in this voice/);
  assert.match(asChosen, /under fifteen words/, "the writer gets the rule, not the feeling");
  // And their own habits survive the choice: a business that says "pop in" says
  // it whichever voice they pick.
  assert.match(asChosen, /pop in/);
  assert.match(asChosen, /still hold where the two do not clash/);

  assert.equal(personaFor(null, "warm"), "", "no persona is no instruction, not a guess");
});

test("both writers use the voice they chose, from one place", () => {
  /**
   * Two copies of this would be two things to keep true, and a post in the
   * wrong voice is the kind of wrong nobody notices until a customer does.
   * The same failure as the guard knowing the real prices and the writer not,
   * which cost a run on 17 September.
   */
  for (const [what, src] of [
    ["the monthly writer", sourceOf("content-social-planner")],
    ["the on-demand writer", read(["app", "workspace", "[tool]", "make-actions.ts"])],
  ] as const) {
    assert.match(src, /personaFor\(/, `${what} does not use the chosen voice`);
  }
});

test("the chosen voice is read from the table, not from an old run", () => {
  /**
   * A run is a snapshot from whenever it happened. The whole point of Brand
   * Persona is that they can change how they sound without waiting for the
   * next one, so the on-demand writer reads the table and the screen puts the
   * persona on a new run when it starts one.
   */
  const make = read(["app", "workspace", "[tool]", "make-actions.ts"]);
  assert.match(make, /from\("content_voice_note"\)[\s\S]{0,120}persona, style/);

  const screen = read(["app", "workspace", "[tool]", "content-social-planner.tsx"]);
  assert.match(screen, /persona: \(persona\?\.persona \?\? null\)/, "a new run starts without the voice");

  // And nothing that worked before stops: no persona falls back to the two
  // sentences the run read for itself.
  assert.match(sourceOf("content-social-planner"), /state\.persona\s*\?/);
});

test("a style nobody built cannot be stored", () => {
  const sql = read(["supabase", "content-planner-2026-09-18-brand-persona.sql"]);
  assert.match(sql, /check \(style in \('original', 'expert', 'warm', 'direct', 'uplifting', 'story'\)\)/);
  // The list in the database and the list in the code are the same list.
  for (const s of STYLES) assert.ok(sql.includes(`'${s.id}'`), `${s.id} is not allowed in the table`);
});

test("every class the persona screen uses exists", () => {
  const css = read(["app", "design.css"]);
  const used = new Set(
    [...read(["app", "workspace", "[tool]", "persona.tsx"]).matchAll(/className=[`"]([^`"{]+)[`"]/g)]
      .flatMap((m) => m[1].split(/\s+/))
      .filter(Boolean),
  );
  const missing = [...used].filter((c) => !css.includes(`.${c}`));
  assert.deepEqual(missing, [], `classes with no stylesheet behind them: ${missing}`);
});

test("the screen says plainly what we cannot read", () => {
  /**
   * Instagram and Facebook both answer "Their robots.txt asks us not to read
   * this page." An owner who pastes a handle and watches nothing happen
   * assumes we are broken; told once, they paste a post instead.
   */
  const src = read(["app", "workspace", "[tool]", "persona.tsx"]);
  assert.match(src, /cannot read Instagram or\s*\n?\s*Facebook/);
  assert.match(src, /do not go around that/);
});
