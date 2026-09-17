import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sourceOf } from "./tool-source.ts";
import {
  CONVERTS,
  INTENTS,
  NOT_BUILT,
  PATHS,
  THOUGHT_MAX,
  THOUGHT_MIN,
  asThought,
  intentAsks,
  isIntent,
  isPath,
  wrongWithRequest,
} from "../tools/content-social-planner/paths.ts";

/**
 * Three ways to ask for a post, eight reasons to write one. Raj, 2026-09-17:
 * a calendar a small business did not ask for produces guilt rather than posts.
 */

test("eight intents, each saying what it asks of the reader", () => {
  assert.equal(INTENTS.length, 8);
  assert.deepEqual(
    INTENTS.map((i) => i.id),
    ["educate", "inspire", "entertain", "inform", "connect", "prove", "promote", "engage"],
  );
  // The label is a word; the ask is what makes the writing different. A menu of
  // eight words with nothing behind them is eight ways to write the same post.
  for (const i of INTENTS) {
    assert.ok(i.asks.length > 20, `${i.id} says nothing about what it asks for`);
    assert.ok(intentAsks(i.id).length > 20);
  }
});

test("the 80/20 split is five that build trust and three that ask", () => {
  const value = INTENTS.filter((i) => !CONVERTS.has(i.id)).map((i) => i.id);
  assert.deepEqual(value, ["educate", "inspire", "entertain", "inform", "connect"]);
  assert.deepEqual([...CONVERTS].sort(), ["engage", "promote", "prove"]);
  assert.equal(CONVERTS.size / INTENTS.length, 0.375, "three of eight, which is the ratio to show");
});

test("starting from a photo is offered and refused, not half built", () => {
  /**
   * Nothing in this product uploads a file: no bucket, no route, no image into
   * a model call. It is on the screen disabled so the shape of the tool is
   * honest, and the action refuses it rather than failing somewhere deeper.
   */
  assert.ok((PATHS as readonly string[]).includes("asset"));
  assert.ok(NOT_BUILT.has("asset"));
  assert.match(wrongWithRequest("asset", "prove", null)!, /not ready yet/i);
  assert.doesNotMatch(wrongWithRequest("asset", "prove", null)!, /bucket|upload|storage|null|undefined/i);
});

test("a thought has to be a thought", () => {
  assert.deepEqual(asThought("  We  had a bride in at 6am today  "), { text: "We had a bride in at 6am today" });
  assert.ok("error" in asThought("hi"));
  assert.ok("error" in asThought("x".repeat(THOUGHT_MAX + 1)));
  assert.ok("error" in asThought(null));
  assert.ok("error" in asThought(42));
  assert.equal(THOUGHT_MIN, 12);
});

test("what is refused, and in whose words", () => {
  assert.match(wrongWithRequest("nonsense", null, null)!, /choose how/i);
  assert.match(wrongWithRequest("category", null, null)!, /what the post is for/i);
  assert.equal(wrongWithRequest("category", "educate", null), null);

  // A thought on its own is enough. Asking what it is for as well is asking
  // them to categorise the thing they just told us.
  assert.equal(wrongWithRequest("thought", null, "The colour we ordered came in the wrong shade"), null);
  assert.match(wrongWithRequest("thought", null, "hm")!, /few more words/i);

  // Nothing on screen is our machinery. Rule 1.4a.
  for (const say of [
    wrongWithRequest("nonsense", null, null),
    wrongWithRequest("category", null, null),
    wrongWithRequest("thought", null, "hm"),
  ]) {
    assert.doesNotMatch(say!, /path|intent|state|null|undefined|schema/i, say!);
  }
});

test("neither list can be reached by a made-up value", () => {
  assert.equal(isIntent("educate"), true);
  assert.equal(isIntent("EDUCATE"), false, "the id is what is stored, not the label");
  assert.equal(isIntent("sell-harder"), false);
  assert.equal(isIntent(null), false);
  assert.equal(isPath("thought"), true);
  assert.equal(isPath("scrape-instagram"), false);
});

// ---------------------------------------------------------------------------
// The screen, and the ways it could be wrong without anybody noticing
// ---------------------------------------------------------------------------

const read = (name: string) =>
  readFileSync(join(import.meta.dirname, "..", "app", "workspace", "[tool]", name), "utf8");

test("every class the screen uses exists in the stylesheet", () => {
  /**
   * The picker shipped against a `.rows` class that nothing defined, so a name,
   * a tag and an address all sat inline and ran into each other. A class
   * nothing defines is invisible until somebody looks at the screen.
   */
  const css = readFileSync(join(import.meta.dirname, "..", "app", "design.css"), "utf8");
  const used = new Set(
    [...read("make.tsx").matchAll(/className="([^"{]+)"/g)]
      .flatMap((m) => m[1].split(/\s+/))
      .filter(Boolean),
  );
  const missing = [...used].filter((c) => !css.includes(`.${c}`));
  assert.deepEqual(missing, [], `classes with no stylesheet behind them: ${missing}`);
});

test("the screen writes no colours, fonts or inline styles of its own", () => {
  const src = read("make.tsx");
  assert.doesNotMatch(src, /#[0-9a-f]{3,8}\b/i, "a hex colour in a tool component");
  assert.doesNotMatch(src, /font-family|fontFamily/, "a font in a tool component");
  assert.doesNotMatch(src, /style=\{\{/, "an inline style in a tool component");
});

test("a textarea is not given an input's fixed height", () => {
  // `.field` is 44px tall, which is right for an input and squashes a three
  // row box to one line.
  const css = readFileSync(join(import.meta.dirname, "..", "app", "design.css"), "utf8");
  assert.match(read("make.tsx"), /className="field field--area"/);
  assert.match(css, /\.field--area\{[^}]*height:auto/);
});

test("every hook sits above anything that uses it", () => {
  /**
   * A hook below an early return threw "Rendered fewer hooks than expected"
   * onto a customer's screen mid-run and took down the loop driving it. This
   * checks the weaker, readable version of the same rule.
   */
  const src = read("make.tsx");
  const firstHook = src.search(/const \w+ = use(State|Router)\(/);
  const firstReturn = src.indexOf("  return (");
  assert.ok(firstHook > 0 && firstHook < firstReturn, "a hook sits below the render");
  assert.ok(
    src.indexOf("const router = useRouter()") < src.indexOf("const ask = async"),
    "router is used by a closure declared above it",
  );
});

test("starting from a photo is on screen, disabled, and says so", () => {
  const src = read("make.tsx");
  const tab = /From a photo[\s\S]{0,120}/.exec(src)?.[0] ?? "";
  assert.match(src, /<button className="tab" role="tab" aria-selected=\{false\} disabled>/);
  assert.match(tab, /Not yet/);
  /**
   * And nothing behind it: no upload, no bucket, no half-written storage.
   *
   * Comments stripped first. The component explains why there is no upload,
   * and a test that fires on its own explanation is a test that can never
   * pass. Third time this has happened in this codebase.
   */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  assert.doesNotMatch(code, /input type="file"|FormData|storage\.from|\.upload\(/i);
});

test("the action refuses before it spends, not after", () => {
  /**
   * Three gates, in this order, and the model call is last. A post has to cite
   * a page on their own site, so with no pages read there is no post that
   * could pass: paying for an answer we already know we will refuse is the
   * waste the gate exists to stop.
   */
  const action = read("make-actions.ts");
  const validate = action.indexOf("wrongWithRequest");
  const gate = action.indexOf("We have not read your website yet");
  const call = action.indexOf("anthropic.messages");
  assert.ok(validate > 0 && gate > validate && call > gate, "the model is called before the gates");

  // And the writing goes through the same guard as the monthly writer.
  assert.match(action, /unsafe\(post as never/, "an on-demand post skips the guard");
  assert.match(action, /priceRules\(business\)/, "the writer is not told the real prices");
});

test("the action reads as the caller, so row level security decides", () => {
  // Never the admin client: a workspace belonging to somebody else must come
  // back as nothing, which is the same answer as one that does not exist.
  const action = read("make-actions.ts");
  assert.match(action, /createClient\(\)/);
  assert.doesNotMatch(action, /createAdminClient/, "the action reads past row level security");
});

test("the table carries row level security from its first migration", () => {
  const sql = readFileSync(
    join(import.meta.dirname, "..", "supabase", "content-planner-2026-09-17-made-posts.sql"),
    "utf8",
  );
  assert.match(sql, /alter table public\.content_made enable row level security/);
  assert.match(sql, /owner_id = auth\.uid\(\)/);
  assert.match(sql, /with check \(/, "a policy that reads but does not check writes");
  // The path that is not built must not be storable even by mistake.
  assert.match(sql, /check \(path in \('category', 'thought'\)\)/);
});

test("what is made is read back and shown", () => {
  /**
   * 2026-09-17. `makePost` wrote to content_made, called revalidatePath, and
   * nothing anywhere read that table. The button worked, the row was saved,
   * and the post was invisible. Raj asked "where do you render the post?" and
   * the answer was nowhere.
   *
   * Every test written with the feature checked the asking and none checked
   * the showing, which is how a half-built thing passed a full suite.
   */
  const screen = read("content-social-planner.tsx");
  assert.match(screen, /from\("content_made"\)/, "nothing reads the table the action writes to");
  assert.match(screen, /made=\{/, "the posts are read and then not passed to the view");

  const view = read("plan.tsx");
  assert.match(view, /<Made made=\{made\} \/>/, "the view is given them and does not render them");

  // And the post itself keeps its shape: a caption's line breaks are part of
  // the caption.
  const css = readFileSync(join(import.meta.dirname, "..", "app", "design.css"), "utf8");
  assert.match(css, /\.made__words\{[^}]*white-space:pre-wrap/);
});

test("every class the made list uses exists", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "app", "design.css"), "utf8");
  const used = new Set(
    [...read("made.tsx").matchAll(/className="([^"{]+)"/g)]
      .flatMap((m) => m[1].split(/\s+/))
      .filter(Boolean),
  );
  const missing = [...used].filter((c) => !css.includes(`.${c}`));
  assert.deepEqual(missing, [], `classes with no stylesheet behind them: ${missing}`);
});

test("a post is asked for in the shape cite understands", () => {
  /**
   * 2026-09-17, and it is why the first live attempt produced nothing.
   *
   * cite() walks what the model returns and turns a key called `from` into a
   * `source` carrying the url and the date we read it. It looks for that one
   * key. The action asked for `source: { page: 2 }` instead, so cite walked
   * past it, the post reached `unsafe` with no url behind it, and every
   * attempt was refused with "nothing on your own site backs it up".
   *
   * Two halves of one question disagreeing, for the second time today: the
   * monthly writer has always asked for `from`.
   */
  /* Comments stripped. The action explains the fault, and the explanation
     quotes the wrong shape, so a test reading the prose fires on the note
     saying not to do it. Third time today. */
  const action = read("make-actions.ts")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
  const schema = action.slice(action.indexOf("input_schema"), action.indexOf("tool_choice"));

  assert.match(schema, /from: \{ type: "integer"/, "the model is not asked for a page number as `from`");
  assert.match(schema, /required: \[[^\]]*"from"\]/, "the page number is optional, so a post can arrive unsourced");
  assert.doesNotMatch(schema, /source: \{/, "it asks for a `source` shape cite does not expand");

  // And the word matches the one cite actually looks for, rather than a word
  // this test also made up.
  assert.match(
    sourceOf("content-social-planner"),
    /if \("from" in record\)/,
    "cite looks for a different key now",
  );
});
