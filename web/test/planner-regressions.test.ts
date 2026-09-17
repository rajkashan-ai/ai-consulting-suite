import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { decidePlan, sayNext } from "../tools/content-social-planner/freshness.ts";
import { contentSocialPlanner, FIRST_STAGE } from "../tools/content-social-planner/index.ts";
import { progressFor, type RunState, type Stage } from "../tools/content-social-planner/stages.ts";
import { PLAN_DAYS } from "../../Agents/Content & Social Planner/src/plan-shape.ts";
import { ANGLES, CADENCES, CADENCE_LABEL, CRITIQUES } from "../../Agents/Content & Social Planner/src/types.ts";
import { recommendCadence } from "../../Agents/Content & Social Planner/src/recommend.ts";
import { sourceOf, specOf } from "./tool-source.ts";

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
  /* Derived, not typed: the wait is whatever the plan covers, and asserting
     that PLAN_DAYS is 30 would police the constant rather than follow it. */
  const next = decidePlan(made, new Date(made)).nextRunAt!;
  assert.equal(Math.round((+new Date(next) - +new Date(made)) / 86400000), PLAN_DAYS);
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
  // The tool, not the file. The planner's stages.ts is 850 lines and the
  // tracker's was split the same week; this checks a cap in a schema and two
  // refusals in a prompt, all of which are true of the tool wherever they sit.
  const stages = sourceOf("content-social-planner");
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
  /**
   * The screen's list, not the document's.
   *
   * These are two contracts and I conflated them: I put the resizer into the
   * block that defines the exported document, and the agent's own test failed,
   * correctly, because a resizer is not a section of a file that goes to their
   * customers. The screen holds two things the document does not, what has gone
   * out and the resizer, and neither belongs in an export.
   */
  const spec = specOf("Content & Social Planner");
  const heading = "### The screen is a different list, and it is also a contract";
  const from = spec.indexOf(heading);
  assert.ok(from > -1, "the spec no longer says what the screen holds");
  const block = spec.slice(from + heading.length, spec.indexOf("\n\n", spec.indexOf("\n\n", from) + 2) + 1);
  const names = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  assert.ok(names.length >= 6, `only ${names.length} sections in the screen contract`);
  return names;
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

/**
 * Every control the design has, still on the screen.
 *
 * Raj: the upload button is gone, the tone buttons at the end of each post are
 * gone, the section under the resizer is gone, check ALL of them.
 *
 * He was right and the list was longer than the three: nineteen buttons and two
 * sections on the designed screen, none of them on the rebuilt one. The screen
 * had been rebuilt as a document, and a document has no controls.
 *
 * So the list is read off the design rather than typed here, the same way the
 * sections are read off the spec. A control that exists on the mockup and not
 * in the app fails here, which is the only arrangement that would have caught
 * this.
 */
function designedControls(): string[] {
  const page = readFileSync(
    join(here, "..", "..", "UI", "workspace.html"),
    "utf8",
  );
  const from = page.indexOf("<!-- CONTENT & SOCIAL PLANNER -->");
  const to = page.indexOf("<!-- FIRST-USE STATES -->");
  assert.ok(from > -1 && to > from, "the designed screen is no longer in UI/workspace.html");
  const section = page.slice(from, to);
  return [...section.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((v, i, all) => all.indexOf(v) === i);
}

test("every control on the designed screen is on the built one", () => {
  /**
   * Comments stripped. Both removed controls are named in a comment saying they
   * were removed, so this passed while the buttons were gone: a guard reading
   * its own explanation, which has now happened four times in this codebase and
   * this is the first time it made a test pass rather than fail.
   */
  /* Stripped per file, then joined. Stripping the joined text let a comment
     opener in one file pair with a closer in the next and swallow everything
     between, which hid two of the resizer's buttons and reported them missing. */
  const built = [
    "plan.tsx", "resizer.tsx", "post-controls.tsx", "plan-controls.tsx", "send-week.tsx",
  ]
    .map((f) => code(screen(f)))
    .join("\n");

  /**
   * A label can reach the screen two ways: written in the component, or read
   * off a shared constant. The cadence names and the five corrections come from
   * `types.ts`, so they are rendered without appearing in any component's text,
   * and a test that only reads source calls them missing.
   *
   * So a label counts as present if the component renders the constant that
   * produces it. Resolved from the same constants the app uses, rather than
   * typed here, or this becomes a third copy of the list.
   */
  const fromConstants = built.includes("CADENCE_LABEL[c]")
    ? Object.values(CADENCE_LABEL)
    : [];
  const fromCritiques = built.includes("Object.values(CRITIQUES)") ? Object.values(CRITIQUES) : [];
  const rendered = [...fromConstants, ...fromCritiques];

  /* Two say the same thing in different words, named here so the exception is
     visible rather than the test being loosened until it passes. */
  const saidDifferently: Record<string, string> = {
    "Connect Instagram": "Connecting one is not built yet",
    "Connect Facebook": "Connecting one is not built yet",
  };

  /**
   * On the mockup and deliberately not built, Raj 2026-09-16.
   *
   * Named rather than dropped from the comparison, so removing a third one is a
   * decision somebody has to write down rather than something that happens.
   */
  const dropped: Record<string, string> = {
    Edit: "editing in the app is not how anyone posts, they write in the app the network gives them",
    "Size a photo": "the resizer is four inches below with its own heading, so a button to scroll to it was furniture",
  };

  const missing = designedControls().filter(
    (label) =>
      !built.includes(saidDifferently[label] ?? label) &&
      !rendered.includes(label) &&
      !(label in dropped),
  );
  assert.deepEqual(missing, [], `controls on the design and not in the app:\n  ${missing.join("\n  ")}`);
});

/* ── the two stylesheets say the same thing about the shared parts ───────── */

const styles = (path: string[]) => readFileSync(join(here, "..", ...path), "utf8");

/** One rule's body, whitespace flattened, from whichever stylesheet. */
function rule(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector}{`);
  assert.ok(at > -1, `${selector} is not in that stylesheet`);
  return css.slice(at + selector.length + 2, css.indexOf("}", at)).replace(/\s+/g, " ").trim();
}

test("no two components share a class name across the stylesheets", () => {
  /**
   * The crop canvas was `.shot` and so is a screenshot block on the preview
   * page, in a different stylesheet, with 48px of padding and a max width. Both
   * are global, so the padding landed on the canvas: a 630 by 420 drawing came
   * out 670 by 468. It read as a stretch, and a stretch is what I went looking
   * for. A collision is the harder of the two to see, because every rule
   * involved is correct on its own.
   */
  const app = styles(["app", "design.css"]);
  const auth = styles(["app", "auth.css"]);
  const named = (css: string) =>
    new Set([...css.matchAll(/^\.([a-z][a-z0-9_-]*)\s*\{/gm)].map((m) => m[1]));

  /**
   * `.grid` is one component's rules split across the two files, not two
   * components sharing a name: auth.css sets the comparison table's widths and
   * design.css its layout, and both belong to the Competitor Tracker. Named
   * here rather than the test being dropped, so the next shared name still
   * fails. Untidy and not a fault; not mine to move.
   */
  const knownPairs = ["grid"];

  const shared = [...named(app)].filter((c) => named(auth).has(c) && !knownPairs.includes(c));
  assert.deepEqual(shared, [], `defined in two stylesheets, so one silently wins: ${shared.join(", ")}`);
});

test("every class this tool uses is defined in a stylesheet", () => {
  /**
   * `.rows` and `.u-push` were used nine times between them and defined
   * nowhere. Two whole sections rendered as raw text at inherited size with no
   * padding and no separator, and it read as "the page is flat" rather than as
   * "this class does nothing", because a class that matches nothing looks
   * exactly like a design decision.
   *
   * `.rows` was in the brief I was given as an existing class. I used it on
   * that word rather than checking, which is the whole reason this test reads
   * the stylesheets instead of a list.
   */
  const css = [styles(["app", "design.css"]), styles(["app", "auth.css"])].join("\n");
  const defined = new Set(
    [...css.matchAll(/(^|[\s,>+~])\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map((m) => m[2]),
  );

  const views = ["plan.tsx", "resizer.tsx", "post-controls.tsx", "plan-controls.tsx", "send-week.tsx", "content-social-planner.tsx"];
  const used = new Set<string>();
  for (const v of views) {
    /* Interpolations are code, not classes. `className={`band ${mod}`}` was
       reporting `mod` as an unstyled class, which is the test reading the
       variable name rather than what it holds. The value it holds is a literal
       elsewhere in the same file, so nothing is lost by dropping the hole. */
    const src = screen(v).replace(/\$\{[^}]*\}/g, " ");
    for (const m of src.matchAll(/className=[{"`]+([^"`}]+)[}"`]+/g)) {
      for (const c of m[1].split(/\s+/)) if (/^[a-z][a-z0-9_-]*$/i.test(c)) used.add(c);
    }
  }

  const orphans = [...used].filter((c) => !defined.has(c)).sort();
  assert.deepEqual(orphans, [], `used on screen and styled by nothing: ${orphans.join(", ")}`);
});

test("the page is laid out in bands, which is the only landmark the system has", () => {
  /* Seven sections on one ground with one heading size is the flatness
     CLAUDE.md 1.4a already paid for once. A band is a change of ground and the
     only thing that says "you are somewhere else now". */
  const view = screen("plan.tsx");
  const bands = [...view.matchAll(/<Band mod="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(bands.length >= 4, `only ${bands.length} bands for seven sections`);
  assert.ok(bands[0].includes("band--first"), "the first band does not sit under the nav");
  assert.ok(bands[bands.length - 1].includes("band--last"), "the last band has no closing space");
  assert.equal(
    bands.filter((b) => b.includes("band--dark")).length,
    1,
    "a screen gets at most one dark band, and it goes to whatever the reader came for",
  );

  /* Section headings are t-section. They were all t-sub, which is the level
     below, so every section announced itself at sub-heading size.
     Checked across every file that renders one: this asserted plan.tsx alone
     and passed while the resizer's own heading, in its own file, stayed t-sub
     and rendered three points smaller than the six around it. */
  const everyView = ["plan.tsx", "resizer.tsx", "post-controls.tsx", "plan-controls.tsx", "send-week.tsx"]
    .map(screen)
    .join("\n");
  const subHeadings = [...everyView.matchAll(/<h2 className="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    subHeadings.filter((c) => !c.includes("t-section")),
    [],
    "a section heading is not t-section",
  );
  assert.ok(subHeadings.length >= 7, `only ${subHeadings.length} section headings found`);
});

test("the preview canvas is not stretched by the stylesheet", () => {
  /**
   * A canvas has its own pixel size, and `width:100%` scales the drawing to the
   * container: a 720 by 420 preview was drawn at 1780 wide with the photo
   * stretched inside it. The agent's suite has caught this in UI/app.css since
   * 15 September. The app's copy was never fixed and had no equivalent test, so
   * it shipped the bug the other file was already protected from.
   */
  const shot = rule(styles(["app", "design.css"]), ".cropper");
  assert.match(shot, /max-width:\s*100%/, "the canvas is stretched to its container");
  assert.doesNotMatch(shot, /(^|;)\s*width:\s*100%/, "width:100% scales the drawing");
});

test("the rules both stylesheets carry say the same thing in both", () => {
  /* The two copies exist because the mockup and the app are separate pages.
     That is a reason for two files, not a licence for two answers. */
  const app = styles(["app", "design.css"]);
  const mock = styles(["..", "UI", "app.css"]);
  for (const selector of [".cropper", ".sizes", ".toggle--stack", ".toggle__who"]) {
    assert.equal(rule(app, selector), rule(mock, selector), `${selector} has drifted between the two`);
  }
});

test("the size chips are a grid of option cards, not a row of pills", () => {
  const view = screen("resizer.tsx");
  assert.match(view, /className="sizes"/, "they are back in a flex row that stretches to the longest label");
  assert.match(view, /toggle toggle--stack/);
  assert.match(view, /className="toggle__who"/, "the chips no longer say what each size is for");
});

test("the photo is drawn after the canvas exists", () => {
  /**
   * The canvas lives inside the block that only renders once there is an image,
   * so drawing when the photo finished loading drew on a ref that was still
   * null. Nothing threw and nothing logged: the owner got a correctly sized
   * empty box, which reads as a styling fault rather than a missing photo.
   */
  const view = screen("resizer.tsx");
  assert.match(view, /useEffect\(\(\) => \{\s*if \(image\) draw\(image, focal\);/,
    "nothing draws after the canvas mounts");
  const onload = view.slice(view.indexOf("img.onload"), view.indexOf("img.src"));
  assert.doesNotMatch(onload, /draw\(/, "it still draws before the canvas exists");
});

test("there is one button to choose a photo, not two controls in one", () => {
  /**
   * The input inside the label rendered the browser's own "Choose file, no file
   * chosen" control inside our button, so the box showed the words twice and a
   * grey control on top of a red one. The test that existed only asked whether
   * there was a label around an input, which was true the whole time it looked
   * broken.
   */
  const view = screen("resizer.tsx");
  assert.match(view, /<label className="btn">/, "the file input has no button around it");
  assert.match(view, /type="file"/, "there is nothing to choose a file with");

  const css = styles(["app", "design.css"]);
  const hidden = rule(css, ".drop label.btn input");
  assert.match(hidden, /clip-path:\s*inset\(50%\)/, "the browser's own control still shows inside ours");
  assert.doesNotMatch(hidden, /display:\s*none/,
    "display:none takes the input out of the keyboard's reach, so nobody tabbing can choose a file");

  /* The label and the line above it said the same words, which read as two
     buttons before either of them rendered. */
  const labels = [...view.matchAll(/>\s*Choose a photo\s*</g)].length;
  assert.equal(labels, 1, `"Choose a photo" appears ${labels} times in the box`);
});

test("the drop zone the stylesheet draws is a drop zone that works", () => {
  /* `.drop.is-over` has been in both stylesheets from the first version, so the
     box has always looked like something you could drop a photo on. It was not.
     A dashed border that does nothing is a promise the screen cannot keep. */
  const view = screen("resizer.tsx");
  for (const handler of ["onDragOver", "onDragLeave", "onDrop"]) {
    assert.ok(view.includes(handler), `the box looks droppable and has no ${handler}`);
  }
  assert.match(view, /is-over/, "nothing shows that a photo is over the box");
  assert.match(view, /dataTransfer\.files/, "a dropped photo is not read");
});

test("a post carries the one control that feeds everything else", () => {
  /**
   * The link. It needs no connected account, it gives us the caption as
   * published, and the difference between what we wrote and what they posted is
   * the most useful thing this tool can learn.
   *
   * Edit and Size a photo were here and are gone. Asserted absent, not merely
   * unmentioned, so neither comes back without somebody deciding it should.
   */
  const controls = code(screen("post-controls.tsx"));
  assert.match(controls, /type="url"/, "there is nowhere to paste the link");
  assert.ok(controls.includes("Posted"), "there is no way to say it went out");
  assert.match(controls, /action=\{markPosted\}/, "the link is collected and written nowhere");

  for (const gone of ["Edit", "Size a photo"]) {
    assert.ok(!controls.includes(gone), `"${gone}" is back on the post without a decision`);
  }
});

test("no control is offered that writes nothing", () => {
  const actions = readFileSync(join(here, "..", "app", "workspace", "[tool]", "planner-actions.ts"), "utf8");
  /* saveEdit went with the Edit button. An action nothing calls is the same
     defect as a button that writes nothing, facing the other way. */
  for (const name of ["markPosted", "toggleCritique", "changeCadence"]) {
    assert.match(actions, new RegExp(`export async function ${name}\\b`), `${name} is wired to nothing`);
    assert.match(
      actions.slice(actions.indexOf(`export async function ${name}`)).slice(0, 2000),
      /\.upsert\(|\.insert\(|\.delete\(/,
      `${name} is called and writes nothing`,
    );
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

/* ── what we already said, and where they actually post ──────────────────── */

test("the next month does not open with this month's post", async () => {
  /**
   * Raj: we keep a record of what we have already suggested, surely. We do,
   * every plan is stored with all thirty days on it, and nothing read it, so
   * the no-repeat rule ran inside one month and reset on the thirty first day.
   *
   * This is the half of "make next month different" that needs no connected
   * account and no metrics. Knowing what worked still does.
   */
  const { shapeMonth } = await import("../tools/content-social-planner/shape.ts");
  const first = shapeMonth("twice-weekly", "2026-09-16T09:00:00.000Z", ["instagram"]);
  const had = [...new Set(first.map((s) => s.angle))];
  const second = shapeMonth("twice-weekly", "2026-10-16T09:00:00.000Z", ["instagram"], had);

  assert.notEqual(second[0].angle, first[0].angle, "month two opens on month one's angle");
  const repeated = [...new Set(second.map((s) => s.angle))].filter((a) => had.includes(a));
  assert.ok(repeated.length <= 1, `month two repeats ${repeated.length} of month one's angles`);

  /* A business with no history is unchanged: this is a tie-break, not a
     reshuffle, and the mix table still has to hold. */
  const fresh = shapeMonth("twice-weekly", "2026-09-16T09:00:00.000Z", ["instagram"], []);
  assert.deepEqual(fresh.map((s) => s.angle), first.map((s) => s.angle));
});

test("the run actually hands the last plan to the shape", async () => {
  /**
   * `shapeMonth` takes the angles already used and pushes them back, and that
   * was tested by calling it directly. Nothing tested that the pipeline passes
   * them, so replacing the argument with an empty list changed nothing and the
   * suite stayed green: the unwired guard again, one layer up.
   */
  const stages = sourceOf("content-social-planner");
  assert.match(
    code(stages),
    /* [^)]* stops at toISOString(), so the match never reached the argument
       it was looking for and the test failed on correct code. */
    /shapeMonth\([\s\S]{0,120}?state\.before\?\.angles/,
    "the shape is built without what we already suggested",
  );

  /* Put on the run by the screen, not loaded by `prepare`: the Db type a tool
     is handed allows one eq and no ordering, so "this tool's newest document"
     cannot be expressed through it, and widening the contract would mean
     changing a file both tools depend on to suit one of them. */
  const panel = screen("content-social-planner.tsx");
  assert.match(code(panel), /before: lastPlan\(document\?\.body\)/, "a new run is started knowing nothing");

  const actions = readFileSync(join(here, "..", "app", "workspace", "[tool]", "planner-actions.ts"), "utf8");
  assert.equal(
    (code(actions).match(/before: lastPlan\(/g) ?? []).length,
    1,
    "changing the cadence starts a run that has forgotten everything",
  );

  /**
   * And the record survives the buttons that trigger a re-run.
   *
   * Both of them deleted the document to force a fresh run, which threw away
   * the only record of what we have already suggested. The two buttons most
   * likely to be pressed destroyed the feature that makes pressing them worth
   * anything. The page reads the newest document, so a new one supersedes the
   * old without anything being removed.
   */
  assert.doesNotMatch(
    code(actions),
    /from\("documents"\)\s*\.delete\(\)/,
    "a re-run deletes the plan the next one learns from",
  );

  /* And the writer is told, or it will write the same post in new words, which
     the angle rule cannot see. */
  assert.match(code(stages), /MUST NOT BE WRITTEN AGAIN/, "the writer is not told what it said last month");
});

test("what a stored plan hands to the next one is narrow on purpose", async () => {
  const { lastPlan } = await import("../tools/content-social-planner/index.ts");
  const before = lastPlan({
    posts: [
      { angle: "what-it-costs", words: "Our prices, so nobody has to ask. Clipper cut is £8." },
      { angle: "the-ask", words: "Chairs free this week. Come in." },
      { angle: "how-it-works" },
    ],
  });
  assert.deepEqual(before?.angles, ["what-it-costs", "the-ask", "how-it-works"]);
  assert.deepEqual(before?.openings, ["Our prices, so nobody has to ask.", "Chairs free this week."]);
  /* Carrying the whole document forward would have the writer echo last month
     word for word, which is the opposite of the point. */
  assert.equal(JSON.stringify(before).includes("Clipper cut is £8"), false);
  assert.equal(lastPlan(null), null);
  assert.equal(lastPlan({ posts: [] }), null);
});

test("where they post is asked, not inferred, and empty is not the same as unasked", async () => {
  const { channelsFor, detectChannels } = await import("../tools/content-social-planner/stages.ts");
  const page = { url: "u", ok: true, title: null, text: "We are on Facebook and Instagram.", fetchedOn: "d", note: "" };

  /* Told beats read. */
  assert.deepEqual(channelsFor({} as never, { told: ["tiktok"], read: [page] } as never), ["tiktok"]);
  /* Asked, and they post nowhere. Must not fall back to reading the page. */
  assert.deepEqual(channelsFor({} as never, { told: [], read: [page] } as never), []);
  /* Never asked. Reading the page is all we have. */
  assert.deepEqual(channelsFor({} as never, { read: [page] } as never), ["instagram", "facebook"]);
  /* Detection is their words, because their links do not survive the reader. */
  assert.deepEqual(detectChannels("Find us on LinkedIn and TikTok."), ["linkedin", "tiktok"]);
  assert.deepEqual(detectChannels("We cut hair."), []);
});

test("the screen asks where they post, and stores the answer on the business", () => {
  const ask = screen("channels.tsx");
  assert.match(ask, /Where do you post\?/);
  assert.match(ask, /type="checkbox"/, "it is a free text box, which a count cannot be read from");
  assert.match(ask, /action=\{saveChannels\}/, "the answer is collected and written nowhere");

  const actions = readFileSync(join(here, "..", "app", "workspace", "[tool]", "planner-actions.ts"), "utf8");
  assert.match(actions, /\.from\("workspaces"\)\.update\(\{ channels/, "it is not stored on the business");
  /* The month is built from the channels, so changing them makes the stored
     plan wrong rather than out of date: the runs go, so the page starts a new
     one. The document stays. It used to be deleted here, which threw away the
     record the next run reads to avoid repeating itself. */
  const after = actions.slice(actions.indexOf("export async function saveChannels"));
  assert.match(after, /\.from\("runs"\)\.delete\(\)/, "changing the channels leaves the old plan up");
  assert.doesNotMatch(after, /\.from\("documents"\)\s*\.delete\(\)/, "it deletes what the next run learns from");
});

test("this tool writes no fetch of its own", () => {
  /**
   * I wrote one on the channels screen to read their home page and suggest
   * platforms, with a comment explaining why that one was fine. CLAUDE.md 1.5
   * says reading the web goes through lib/research/fetch.ts, which obeys robots
   * and queues per host, and a comment arguing an exception is how a rule stops
   * being a rule.
   */
  const files = ["plan.tsx", "resizer.tsx", "post-controls.tsx", "plan-controls.tsx", "send-week.tsx", "channels.tsx", "content-social-planner.tsx"];
  for (const f of files) {
    assert.doesNotMatch(code(screen(f)), /\bfetch\(/, `${f} fetches the web without going through lib/research`);
  }
  const dir = join(here, "..", "tools", "content-social-planner");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
    assert.doesNotMatch(
      code(readFileSync(join(dir, f), "utf8")),
      /\bfetch\(/,
      `${f} fetches the web without going through lib/research`,
    );
  }
});

test("hashtags come off, because they do not do what people think", async () => {
  const { unTag, hasTag } = await import("../tools/content-social-planner/scrub.ts");
  /**
   * Adam Mosseri, who runs Instagram, on the record: hashtags are not a way to
   * get more reach. LinkedIn removed hashtag following and hashtag pages in
   * late 2024. Both read the caption itself for topic now, so the thing that
   * replaced them is plain keywords in the sentence.
   */

  assert.equal(unTag("Come in this week.\n\n#barber #shrewsbury"), "Come in this week.");
  assert.equal(unTag("Book your #skinfade today."), "Book your skinfade today.");
  assert.equal(hasTag(unTag("Words.\n#one\n#two\nMore.")), false);

  const stages = sourceOf("content-social-planner");
  assert.match(stages, /never write a hashtag/i, "the model is not told");
  assert.match(stages, /words somebody would actually search for/i, "it is not told what to do instead");
  assert.match(stages, /unTag\(/, "the guard exists and nothing calls it");
});

test("reading a whole site fits inside the steps the watchdog allows", async () => {
  /**
   * The watchdog allows six steps in `reading` and says why in a comment: the
   * Competitor Tracker fetches eight pages a step. This tool fetched one, and
   * spent a further step building the queue without reading anything, so a site
   * with a real sitemap needed seven and was stopped having read five pages and
   * used none of them.
   *
   * The barber never showed it, because two pages fit. A Hertfordshire salon on
   * WordPress with a declared sitemap did, on the first live run against it.
   *
   * The caps are keyed by the Tracker's stage names and sized for its work,
   * which is the same shared-thing-knows-one-tool defect as the engine, the
   * page and the running screen. `lib/watchdog.ts` is read-only to a tool, so
   * this fits inside the cap rather than changing it.
   */
  const { CAPS } = await import("../lib/watchdog.ts");
  const { advance } = await import("../tools/content-social-planner/stages.ts");

  /* A site with five readable pages and a sitemap that names them. */
  const pages = ["/", "/prices", "/services", "/about", "/booking"];
  /* As the real reader hands it back: tags stripped, addresses surviving.
     Written as raw xml, this fixture was easier to satisfy than the thing it
     stands in for and the live run fell through to guessing. */
  const sitemap = pages.map((p) => `https://x.test${p}`).join("\n");
  const ctx = {
    read: async (url: string) => ({
      ok: true,
      url,
      text: url.endsWith("robots.txt")
        ? "User-agent: *\nSitemap: https://x.test/wp-sitemap.xml"
        : url.endsWith(".xml")
          ? sitemap
          : "Words about the salon, enough of them to count as a page worth reading.",
      title: null,
      fetchedAt: "2026-09-16T09:00:00.000Z",
      note: "",
    }),
    think: async () => ({}),
    search: async () => [],
    progress: () => {},
  };

  let stage = "reading";
  let state: Record<string, unknown> = {};
  let steps = 0;
  while (stage === "reading" && steps < 20) {
    const step = await advance(stage as never, state as never, { website: "https://x.test" } as never, ctx as never);
    stage = step.stage;
    state = step.state as never;
    steps += 1;
  }

  assert.notEqual(stage, "failed", `reading failed: ${(state as { reason?: string }).reason}`);
  assert.ok(
    steps < CAPS.reading,
    `reading took ${steps} steps and the watchdog stops it at ${CAPS.reading}`,
  );
  assert.ok(((state as { pages?: unknown[] }).pages ?? []).length >= 2, "it read a site and numbered nothing");
});

test("a sitemap the site declares in robots.txt is the one we read", async () => {
  /**
   * `lib/research/sitemap.ts` tries `/sitemap.xml`, which is right for most
   * sites and wrong for WordPress, where it is `/wp-sitemap.xml`. A salon on
   * WordPress therefore fell through to guessing paths, four of the five 404s
   * fetched one at a time with a pause between. robots.txt is where a site is
   * supposed to declare it.
   */
  const { worthReading } = await import("../tools/content-social-planner/stages.ts");
  const asked: string[] = [];
  const ctx = {
    read: async (url: string) => {
      asked.push(url);
      if (url.endsWith("robots.txt")) {
        return { ok: true, url, text: "Sitemap: https://x.test/wp-sitemap.xml", title: null, fetchedAt: "", note: "" };
      }
      if (url.endsWith("wp-sitemap.xml")) {
        return { ok: true, url, text: "https://x.test/services-price-list/", title: null, fetchedAt: "", note: "" };
      }
      return { ok: false, url, text: "", title: null, fetchedAt: "", note: "not there" };
    },
    think: async () => ({}),
    search: async () => [],
    progress: () => {},
  };

  const home = { url: "https://x.test/", ok: true, title: null, text: "Words.", fetchedOn: "d", note: "" };
  const found = await worthReading("https://x.test", home as never, ctx as never);

  assert.ok(asked.some((u) => u.endsWith("/robots.txt")), "it never asked where the sitemap is");
  assert.deepEqual(found, ["https://x.test/services-price-list/"]);
  /* And having found one, it does not go on to guess. */
  assert.equal(asked.filter((u) => /\/prices$|\/menu$/.test(u)).length, 0, "it guessed anyway");
});

test("one page is read once, whatever the trailing slash", async () => {
  const { worthReading } = await import("../tools/content-social-planner/stages.ts");
  const ctx = {
    read: async (url: string) => ({
      ok: true,
      url,
      text: url.endsWith("robots.txt")
        ? "Sitemap: https://x.test/wp-sitemap.xml"
        : "https://x.test/services-price-list/\nhttps://x.test/services-price-list",
      title: null,
      fetchedAt: "",
      note: "",
    }),
    think: async () => ({}),
    search: async () => [],
    progress: () => {},
  };
  const home = { url: "https://x.test/", ok: true, title: null, text: "Words.", fetchedOn: "d", note: "" };
  const found = await worthReading("https://x.test", home as never, ctx as never);
  assert.equal(found.length, 1, `the same page twice: ${JSON.stringify(found)}`);
});

test("no fake in these tests is easier to satisfy than the real reader", () => {
  /**
   * THE TRAP THAT KEEPS COMING BACK. Three times in this tool now:
   *
   *  1. the page fixture was captured with a plain fetch, so the code parsed
   *     anchors that do not survive, and the live run would have written a
   *     month of posts with no prices in them;
   *  2. a fake matched urls by exact string while the real reader follows
   *     redirects, so every offline test failed at the first page;
   *  3. a sitemap fake handed back raw xml, so a parser looking for <loc>
   *     passed here and found nothing on any real site, and the live run fell
   *     through to guessing paths and read four 404s.
   *
   * Each cost a live run to find. The rule is one line: `lib/research/fetch.ts`
   * hands back visible text, and `visibleText` strips every tag before anything
   * else sees it. A fake that returns markup is testing a reader we do not have.
   *
   * Checked on the fakes themselves rather than on their output, because a fake
   * is a fixture and a fixture nobody compares to reality drifts back.
   */
  const files = ["planner.test.ts", "planner-regressions.test.ts"];
  const offenders: string[] = [];

  for (const f of files) {
    const src = readFileSync(join(here, f), "utf8");
    /* Only the text a fake hands back, which is what the reader would have
       stripped. Assertions about markup elsewhere are not fakes. */
    for (const m of src.matchAll(/text:\s*(?:url\.endsWith[\s\S]{0,400}?|)(["'`])([\s\S]*?)\1/g)) {
      const handed = m[2];
      if (/<[a-z][a-z0-9]*(\s|>|\/)/i.test(handed)) {
        offenders.push(`${f}: a fake hands back markup: ${handed.slice(0, 60)}`);
      }
    }
  }

  assert.deepEqual(offenders, [], offenders.join("\n  "));
});

test("the fixture on disk is still what the reader would have produced", () => {
  /* The same rule for the captured pages, asserted separately because a fixture
     is recaptured by hand and a fake is written by hand, and they drift apart
     for different reasons. */
  const fixture = JSON.parse(
    readFileSync(join(here, "..", "tools", "content-social-planner", "fixtures", "barber.json"), "utf8"),
  ) as { pages: { url: string; text: string }[] };

  for (const p of fixture.pages) {
    if (p.url.endsWith(".xml")) continue;
    assert.doesNotMatch(p.text, /<[a-z][a-z0-9]*(\s|>|\/)/i, `${p.url} holds markup the reader strips`);
  }
});

/* ── facts that live in two places, checked against each other ───────────── */

test("a cadence button gives the cadence it is labelled with", () => {
  /**
   * The button used to send a number of hours, which `recommend.ts` turned back
   * into a cadence using a rule that also reads how many channels they have. So
   * with one channel, "A couple of times a week" rebuilt the month as once a
   * week. The test that found it asserted the round trip rather than repeating
   * the numbers, which is why it found it at all.
   *
   * The button sends the cadence now, so the assertion is that nothing converts
   * it on the way and that every cadence has a button.
   */
  const controls = screen("plan-controls.tsx");
  assert.doesNotMatch(controls, /HOURS/, "the button is guessing hours again");
  assert.match(controls, /name="cadence" value=\{c\}/, "the button does not send what it says");

  const actions = readFileSync(join(here, "..", "app", "workspace", "[tool]", "planner-actions.ts"), "utf8");
  assert.match(actions, /chose: cadence/, "what they pressed is not carried to the run");

  /* And it wins, whatever the channels would have suggested. One channel is the
     case that broke: the starting point is weekly there. */
  const known = {
    services: ["a cut"], prices: {}, accreditations: [], awards: [], namedClients: [],
    counts: {}, reviewThemes: [], servesAnArea: true,
  };
  for (const cadence of CADENCES) {
    for (const channels of [["instagram"], ["instagram", "facebook"]]) {
      const got = recommendCadence(known as never, { chose: cadence }, channels as never);
      assert.equal(got.cadence, cadence, `chose ${cadence} with ${channels.length} channel(s), got ${got.cadence}`);
      assert.ok(
        got.because.some((r) => /you asked for/i.test(r.text)),
        "it does not say the number came from them",
      );
      assert.ok(
        !got.because.some((r) => /hours a week/i.test(r.text)),
        "it still claims they told us how much time they have",
      );
    }
  }
});

test("the angle each purpose may use is the same list in both places", () => {
  /**
   * `shape.ts` holds the map because the agent's copy lives in a command line
   * runner that imports node:fs and cannot be pulled into a server bundle. That
   * is a reason for two copies, not for two answers, and nothing compared them.
   */
  const mine = sourceOf("content-social-planner");
  const theirs = readFileSync(
    join(here, "..", "..", "Agents", "Content & Social Planner", "bin", "plan.mjs"),
    "utf8",
  );

  const listsIn = (src: string, from: string) => {
    const at = src.indexOf(from);
    assert.ok(at > -1, `${from} is gone`);
    const block = src.slice(at, src.indexOf("};", at));
    return Object.fromEntries(
      [...block.matchAll(/(\w+):\s*\[([^\]]*)\]/g)].map((m) => [
        m[1],
        [...m[2].matchAll(/['"]([a-z-]+)['"]/g)].map((x) => x[1]),
      ]),
    );
  };

  assert.deepEqual(listsIn(mine, "const BY_PURPOSE"), listsIn(theirs, "const byPurpose = {"));
});

test("every angle the shape can pick is one the agent folder defines", () => {
  /* And the map cannot name an angle that does not exist, which a hand-written
     list can and a typo would make silently unreachable. */
  const mine = sourceOf("content-social-planner");
  const block = mine.slice(mine.indexOf("const BY_PURPOSE"), mine.indexOf("};", mine.indexOf("const BY_PURPOSE")));
  const named = [...block.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);

  assert.ok(named.length >= 10, `only ${named.length} angles mapped`);
  for (const a of named) assert.ok((ANGLES as readonly string[]).includes(a), `"${a}" is not an angle`);
  for (const a of ANGLES) assert.ok(named.includes(a), `"${a}" exists and no purpose can pick it`);
});
