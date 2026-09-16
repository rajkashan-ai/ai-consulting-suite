import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { decidePlan, sayNext } from "../tools/content-social-planner/freshness.ts";
import { contentSocialPlanner, FIRST_STAGE } from "../tools/content-social-planner/index.ts";
import { progressFor, type RunState, type Stage } from "../tools/content-social-planner/stages.ts";
import { PLAN_DAYS } from "../../Agents/Content & Social Planner/src/plan-shape.ts";

/**
 * One test per thing that broke, so it cannot break again quietly.
 *
 * Written after an audit of everything fixed in this tool's first day, against
 * what actually guarded it. Five of them had nothing at all: the fixture's
 * provenance, the first stage, the freshness rule, the voice note's shape, and
 * the screen. Each of those is a fix that would have come undone with a green
 * suite, which is the failure this file exists to prevent.
 */

const here = import.meta.dirname;
const tool = (f: string) => readFileSync(join(here, "..", "tools", "content-social-planner", f), "utf8");
const screen = (f: string) => readFileSync(join(here, "..", "app", "workspace", "[tool]", f), "utf8");

/**
 * Source with the comments taken out.
 *
 * A guard that reads a file's text will read the comment explaining the guard,
 * and then fire on it. That has now happened three times in this codebase: the
 * running screen "naming a tool" in a note about how it used to, the Meta
 * connect prose, and the resizer "uploading" in a line saying it never does.
 * A comment saying a file does not do something is not the file doing it.
 */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

/* ── 1. The fixture is what the reader hands back, not what curl does ─────── */

const FIXTURE = JSON.parse(
  readFileSync(join(here, "..", "tools", "content-social-planner", "fixtures", "barber.json"), "utf8"),
) as { from: string; pages: { url: string; text: string }[] };

test("the fixture is text the real reader produced, not raw markup", () => {
  /**
   * The whole class of failure this tool spent its first day on. The fixture was
   * captured with a plain fetch, the code parsed anchors out of it, and every
   * offline test passed while the live run would have read one page and written
   * a month of posts with no prices in them.
   *
   * lib/research/fetch.ts returns visible text: visibleText strips script,
   * style, nav, header and footer, and keeps a link as "words (url)". A fixture
   * containing markup is a fixture easier to satisfy than the thing it stands
   * in for, which is the same defect as a test that cannot fail.
   */
  const pages = FIXTURE.pages.filter((p) => !p.url.endsWith(".xml"));
  assert.ok(pages.length >= 2, "too few real pages to prove anything");

  for (const p of pages) {
    assert.doesNotMatch(p.text, /<a\s|<div|<script|href=/i, `${p.url} still holds markup`);
  }
  const all = pages.map((p) => p.text).join("\n");
  assert.match(all, /\(https?:\/\/[^)]+\)/, "no link survived as an address, so the capture is wrong");
});

test("the sitemap in the fixture is the xml the reader returns", () => {
  const xml = FIXTURE.pages.filter((p) => p.url.endsWith(".xml"));
  assert.ok(xml.length, "no sitemap captured, so the discovery path is untested");
  for (const p of xml) assert.match(p.text, /<loc>/i, `${p.url} is not a sitemap`);
});

test("the fixture says where it came from", () => {
  assert.match(FIXTURE.from, /visibleText|read live/i, "a fixture with no provenance is a fixture nobody can check");
});

/* ── 2. The first stage is named, not inherited from another tool ─────────── */

test("a run starts in a stage this tool knows", async () => {
  /**
   * runs.stage defaults to 'searching' in the schema, which is the Competitor
   * Tracker's first stage, written there before there was a second tool. A run
   * inserted without a stage starts somewhere this tool has never heard of and
   * stops on its first tick, having said nothing.
   */
  assert.equal(FIRST_STAGE, "reading");
  const step = await contentSocialPlanner.advance(
    "searching" as never,
    {} as never,
    { website: "https://x.test", services: [], foundVia: [] } as never,
    { read: async () => ({ ok: false, url: "", text: "", title: null, fetchedAt: "", note: "" }),
      think: async () => ({}), search: async () => [], progress: () => {} } as never,
  );
  assert.notEqual(step.stage, "done", "a stage it does not know reported success");
});

test("the screen inserts the stage rather than letting the column choose", () => {
  const panel = screen("content-social-planner.tsx");
  assert.match(panel, /stage: FIRST_STAGE/, "the run is inserted with no stage, so it inherits the tracker's");
});

/* ── 3. Freshness is this tool's, not the tracker's week ─────────────────── */

test("a plan covers a month, so the next one is a month away", () => {
  const made = "2026-09-16T09:00:00.000Z";
  const soon = new Date("2026-09-30T09:00:00.000Z");
  const later = new Date("2026-10-16T09:00:00.000Z");

  assert.equal(decidePlan(made, soon).allowed, false, "it would rewrite a month nobody has posted yet");
  assert.equal(decidePlan(made, later).allowed, true, "the month ran out and it will not make another");
  assert.equal(decidePlan(null, soon).allowed, true, "a business with no plan cannot get one");
});

test("the wait is not the tracker's week", () => {
  const made = "2026-09-16T09:00:00.000Z";
  const aWeekLater = new Date("2026-09-23T09:00:00.000Z");
  assert.equal(decidePlan(made, aWeekLater).allowed, false, "it is running weekly, which is the other tool's rule");
  assert.equal(PLAN_DAYS, 30);
});

test("a clock that went backwards does not strand them for a month", () => {
  const future = "2026-12-01T00:00:00.000Z";
  assert.equal(decidePlan(future, new Date("2026-09-16T09:00:00.000Z")).allowed, true);
  assert.equal(decidePlan("not a date", new Date()).allowed, true);
});

test("what they are told about the wait is a date, not a rule", () => {
  const said = sayNext(decidePlan("2026-09-16T09:00:00.000Z", new Date("2026-09-20T09:00:00.000Z")));
  assert.match(said, /16 October/);
  assert.doesNotMatch(said, /stage|cadence rule|freshness|PLAN_DAYS/i);
});

/* ── 4. The voice note is a summary, and never a report card ─────────────── */

test("the voice note is capped in the shape and told not to mark their writing", () => {
  /**
   * At 420 characters it came back as a paragraph of criticism of the owner's
   * own copy, with six quotes in it. Raj, 2026-09-16: a summary, more generic,
   * never rude. A length asked for in prose drifts, so the cap is in the schema.
   */
  const stages = tool("stages.ts");
  assert.match(stages, /words: \{ type: "string", minLength: 40, maxLength: 260, pattern: NO_DASH \}/);
  assert.match(stages, /never marking/i, "nothing stops it grading their copy");
  assert.match(stages, /Never call it plain, basic, functional/i, "the words it reached for are not refused");
});

test("the screen says what the voice note was read off", () => {
  const view = screen("plan.tsx");
  assert.match(view, /Read off/, "the reader cannot tell where this came from");
  assert.match(view, /plan\.voice\.source/, "the address is written by hand rather than from the source");
});

/* ── 5. The screen shows the plan, and none of our machinery ─────────────── */

/**
 * The sections, read out of the spec rather than typed here.
 *
 * The first version of this test listed the five sections I had built. The
 * resizer had been built, tested and on the mockup, was never written into the
 * spec's contract, and so was dropped when the screen was rebuilt for the app,
 * with this test green the whole time. A test that enumerates what the code
 * does is the first trap in TESTING.md 7, and I walked into it while writing
 * the file whose whole purpose is stopping regressions.
 *
 * Reading the contract means adding a section to the spec makes this fail until
 * the screen has it, which is the direction the dependency should run.
 */
function contract(): string[] {
  const spec = readFileSync(
    join(here, "..", "..", "Agents", "Content & Social Planner", "CLAUDE.md"),
    "utf8",
  );
  const from = spec.indexOf("## What we suggest");
  const to = spec.indexOf("```", from);
  assert.ok(from > -1 && to > from, "the spec no longer holds a section contract");
  return [...spec.slice(from, to).matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
}

test("the spec still holds a contract worth checking against", () => {
  const sections = contract();
  assert.ok(sections.length >= 6, `only ${sections.length} sections in the contract`);
  assert.ok(sections.includes("Resize a photo"), "the resizer is out of the contract again");
});

test("the screen carries every section the spec promises", () => {
  const view = screen("plan.tsx") + screen("resizer.tsx");
  /* Two of the contract's names are the spec's words for things the screen
     says in its own: the cadence panel and the blanks count. Named here so the
     exception is visible rather than the test being loosened to let anything
     through. */
  const saidDifferently: Record<string, string> = {
    "What we suggest": "How often we suggest you post",
    "What to fill in": "line from you",
  };
  for (const section of contract()) {
    const wanted = saidDifferently[section] ?? section;
    assert.ok(view.includes(wanted), `the screen lost "${section}"`);
  }
});

test("the resizer does the work on their machine and says so", () => {
  const view = screen("resizer.tsx");
  assert.match(view, /never leaves your computer/i, "nothing tells them where the photo goes");
  assert.doesNotMatch(code(view), /fetch\(|FormData|upload/i, "the photo is being sent somewhere");
  /* The geometry is imported, not written again. Both bugs Raj found in the
     resizer were geometric and both fixes live in preview.js. */
  assert.match(view, /from "\.\.\/\.\.\/\.\.\/\.\.\/Agents\/Content & Social Planner\/src\/preview\.js"/);
  assert.match(view, /cropBox|fitPreview/, "it no longer uses the tested geometry");
  assert.doesNotMatch(view, /function cropBox|function fitPreview/, "a second copy of the geometry");
});

test("no stage name, page number or token count can reach the screen", () => {
  const view = screen("plan.tsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  for (const ours of ["stage", "token", "schema", "page 1", "guard", "prompt"]) {
    assert.doesNotMatch(view, new RegExp(`>\\s*[^<]*${ours}`, "i"), `"${ours}" is rendered on the page`);
  }
});

test("progress is said in their units, never in ours", () => {
  const state: RunState = { read: [{} as never, {} as never], slots: [{ week: 1 } as never] };
  for (const stage of ["reading", "voice", "shaping", "writing", "checking"] as Stage[]) {
    const said = progressFor(stage, state);
    assert.ok(said.length > 4, `${stage} says nothing`);
    for (const ours of ["stage", "token", "schema", "guard", "advance", "state"]) {
      assert.doesNotMatch(said, new RegExp(ours, "i"), `${stage} says "${ours}" to the owner`);
    }
  }
});

/* ── 6. Everything written is wired to something ─────────────────────────── */

test("every check in this tool is wired to something that runs", () => {
  /**
   * The lesson this tool's own memory repeats most: a test proves a function
   * works, never that anything calls it. Both tools shipped a guard that was
   * written, tested, and wired to nothing.
   *
   * What counts as wired is a reference from something that runs, not only a
   * call: `buildBody` is handed to the engine as a value through the contract
   * and never called inside this folder, and `decidePlan` is called by the
   * screen. Counting calls in the tool folder alone marked both as orphans,
   * which is a test that fires for the wrong reason, and the fix for that is
   * never to lower the bar until it goes quiet.
   *
   * Declarations and imports are removed first, so a check that is only ever
   * declared and imported still fails.
   */
  const dir = join(here, "..", "tools", "content-social-planner");
  const runs = [
    ...readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => readFileSync(join(dir, f), "utf8")),
    screen("content-social-planner.tsx"),
    screen("plan.tsx"),
  ].join("\n");

  const checks = [
    "unsafe", "houseStyle", "unDash", "hasDash", "belowTheBar",
    "expand", "cite", "numberPages", "shapeMonth", "worthReading",
    "channelsFor", "knownFacts", "decidePlan", "sayNext", "hollow", "buildBody",
  ];

  for (const name of checks) {
    assert.ok(
      new RegExp(`export (async )?(function|const) ${name}\\b`).test(runs),
      `${name} is asserted here but no longer exists`,
    );

    const other = runs
      .replace(new RegExp(`export (async )?function ${name}\\b`, "g"), "DECLARED")
      .replace(new RegExp(`export const ${name}\\b`, "g"), "DECLARED")
      .replace(new RegExp(`^.*\\bimport\\b.*$`, "gm"), "")
      .replace(new RegExp(`export \\{[^}]*\\}`, "g"), "");

    const mentions = [...other.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;
    assert.ok(mentions >= 1, `${name} is written and nothing that runs refers to it`);
  }
});
