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

test("starting from a photo is built, and asks for both halves", () => {
  /**
   * Built 2026-09-18. A photo on its own can only produce a description: it
   * carries no price and no booking line. So the path asks for two things, and
   * refuses with the reason rather than failing somewhere deeper.
   */
  assert.ok((PATHS as readonly string[]).includes("asset"));
  assert.equal(NOT_BUILT.has("asset"), false, "the path is built and still marked as not");

  const photo = "data:image/jpeg;base64,/9j/4AAQ";
  assert.match(wrongWithRequest("asset", null, null, null, null)!, /choose a photo/i);
  assert.match(wrongWithRequest("asset", null, null, photo, null)!, /which of your services/i);
  assert.match(wrongWithRequest("asset", null, null, photo, "   ")!, /which of your services/i);
  assert.equal(wrongWithRequest("asset", null, null, photo, "Balayage"), null);

  /* A category is not what this path asks for, so supplying one changes
     nothing: the photo and the service are the two halves. */
  assert.match(wrongWithRequest("asset", "prove", null, null, "Balayage")!, /choose a photo/i);
});

test("nothing that is still unbuilt can be selected or run", () => {
  /**
   * NOT_BUILT is empty now. It is kept rather than deleted because it is the
   * one place a half built path is disabled, and this checks the mechanism
   * still works rather than checking the set is empty.
   */
  for (const path of NOT_BUILT) {
    assert.match(wrongWithRequest(path, "prove", null, null, null)!, /not ready yet/i);
  }
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

test("the photo is downscaled here and stored nowhere", () => {
  /**
   * The promise on the screen is that the photo never leaves their machine at
   * full size and is never kept. That is two claims, and both are checkable.
   *
   * Comments stripped first. The component explains why there is no bucket,
   * and a test that fires on its own explanation is a test that can never
   * pass. Fourth time this has happened in this codebase.
   */
  const src = read("make.tsx");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  /* Taken in, drawn small, and turned into a string, all in the browser. */
  assert.match(code, /type="file"/, "there is no way to choose a photo");
  assert.match(code, /drawAt\(/, "the photo is sent at whatever size it arrived");
  assert.match(code, /toDataURL\(SENT_AS, QUALITY\)/, "it is not written out as our one format");

  /* And nowhere to put it. A bucket is the thing this design does not have. */
  assert.doesNotMatch(code, /storage\.from|\.upload\(|createBucket/i, "the photo is being stored");

  /* Said to them, not only to us. */
  assert.match(src, /never leaves your computer/i, "nothing tells them where the photo goes");
  assert.match(src, /not kept/i, "nothing tells them it is not stored");
});

test("a photo that is not the service they named is refused, not written around", () => {
  /**
   * Found on a live call, 2026-09-18. Handed a photo of a desk and told it was
   * a Ladies Cut & Finish, the writer described the desk accurately, said in
   * the shot line that no haircut was visible, and attached the £51 cut price
   * anyway. Honest about the picture and wrong for the owner.
   *
   * It can plainly tell. It was never asked. So it is asked, and the decision
   * is ours: on the same photo it now answers shows:false and still writes a
   * post, because a model told to write nothing writes something. We do not
   * depend on it obeying, only on it observing.
   */
  const action = read("make-actions.ts");
  const code = action.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  assert.match(code, /shows: \{/, "the writer is never asked whether the photo is the service");
  assert.match(code, /required: \["words", "shot", "why", "intent", "from", \.\.\.\(sent \? \["shows"\] : \[\]\)\]/,
    "shows is optional, so a silent model would pass the check");
  assert.match(code, /answer\.shows === false/, "the answer is asked for and not read");

  /* Refused before anything is saved, and before the guard, because the guard
     cannot see this: a real price cited to a real page passes every check. */
  assert.ok(
    code.indexOf("answer.shows === false") < code.indexOf('from("content_made")'),
    "a mismatched photo is saved and then refused",
  );

  /* In their words, naming the service, with something to do about it. */
  const refusal = /does not look like \$\{service\}[^`]*/.exec(action)?.[0] ?? "";
  assert.match(refusal, /Pick the service it shows|choose another photo/i, "the refusal says nothing to do");
});

test("the action is handed a photo and never a file", () => {
  /**
   * A server action takes a body of 1 MB before Next refuses it with a 413,
   * which reaches the owner as a failure with no explanation. The photo is
   * downscaled to a string on their machine, so what crosses is small and is
   * never a file upload.
   */
  const action = read("make-actions.ts");
  const code = action.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  assert.match(code, /asPhoto\(photo\)/, "the data url is not checked before it is sent");
  assert.doesNotMatch(code, /FormData|storage\.from|\.upload\(/i, "a file is crossing to the server");
  assert.match(code, /type: "image"/, "the photo never reaches the writer");
  assert.match(code, /from_photo: Boolean\(sent\)/, "the model is trusted to say a photo was there");
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
  // The refusal itself now lives in sources.ts as `tooThinToWrite`, so the
  // marker here is the call rather than the sentence. test/gates.test.ts runs
  // the rule; this one only checks it is asked before the model is paid.
  const gate = action.indexOf("tooThinToWrite(pages");
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
  /* The required list, read as a line rather than with a bracket-counting
     pattern: it carries a conditional spread now, because `shows` is required
     on the photo path and not on the other two, and the old pattern stopped at
     the first close bracket inside it. What is being asserted is unchanged. */
  const required = schema.slice(schema.indexOf("required: [")).split("\n")[0];
  assert.match(required, /"from"/, "the page number is optional, so a post can arrive unsourced");
  assert.doesNotMatch(schema, /source: \{/, "it asks for a `source` shape cite does not expand");

  // And the word matches the one cite actually looks for, rather than a word
  // this test also made up.
  assert.match(
    sourceOf("content-social-planner"),
    /if \("from" in record\)/,
    "cite looks for a different key now",
  );
});
