import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advance, type RunState } from "../tools/competitor-tracker/stages.ts";
import { aBusiness, fakeContext, type Recorded , ownerAgrees} from "./fake.ts";

/**
 * What an owner is shown when something throws.
 *
 * lib/engine.ts imports `server-only`, so it cannot be imported here. The
 * project already tests that file by reading it, in regressions.test.ts
 * ("every model call is streamed"), so the same method is used.
 *
 * The rule being tested: nothing about how the product is built reaches the
 * customer's screen. UI/CLAUDE.md section 7 rule 7.
 */

const engine = readFileSync(join(import.meta.dirname, "..", "lib", "engine.ts"), "utf8");

const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as Recorded;

const MACHINERY =
  /\btoken\b|\btokens\b|\bshape\b|\bschema\b|\bprompt\b|\bmodel\b|\bapi\b|\bjson\b|max_tokens|tool_use|stop_reason/i;

test("breakit: a thrown error is not handed to the customer word for word", () => {
  // The only catch around the pipeline. Whatever it caught becomes the run's
  // `progress` and `error`, which is what the screen reads.
  /**
   * To the end of the block, not to an arbitrary number of characters.
   *
   * This was capped at 300 and went red on 2026-09-17 because a comment made
   * the block longer, which is a test failing for the size of an explanation
   * rather than for the rule it guards.
   */
  const caught = engine.match(/catch \(e\) \{[\s\S]*?\n  \}/);
  assert.ok(caught, "could not find the catch around advance()");

  assert.doesNotMatch(
    caught![0],
    /e instanceof Error \? e\.message : String\(e\)/,
    `the raw exception text is shown to the customer:\n${caught![0]}`,
  );
});

test("breakit: the errors this product throws would be safe to show", () => {
  /**
   * Every error the engine builds, since each one can reach the screen through
   * that catch.
   *
   * Widened on 2026-09-16, by the builder, and said plainly because this is a
   * tester's test: it looked for `throw new Error(` only. The fix moved both
   * throws into named helpers that build the error and set the machinery on
   * `cause`, so the old pattern matched nothing and the test failed its own
   * "at least 2" check rather than finding a leak. Scanning every `new Error(`
   * covers the helpers as well as any inline throw, so this is broader than
   * what it replaces, not narrower.
   */
  const thrown = [...engine.matchAll(/new Error\(([\s\S]*?)\);\n/g)].map((m) =>
    m[1].replace(/\s+/g, " ").trim(),
  );
  assert.ok(thrown.length >= 2, `only found ${thrown.length} thrown errors`);

  const leaks = thrown.filter((t) => MACHINERY.test(t));
  assert.deepEqual(
    leaks,
    [],
    `messages that would go straight to an owner's screen:\n  ${leaks.join("\n  ")}`,
  );
});

test("breakit: an exception inside a step does not escape as raw text", async () => {
  // A stage that throws for any reason at all. The fake throws a message with
  // our own vocabulary in it, exactly as the real `think` does.
  const ctx = {
    read: async (url: string) => ({
      ok: true, url, text: recorded.competitorPage.text, title: "x",
      fetchedAt: new Date().toISOString(), note: "",
    }),
    think: async () => {
      throw new Error('The answer was cut off at 9000 tokens while building "comparison".');
    },
    search: async () => recorded.searchResults,
    progress: () => {},
  } as never;

  let state: RunState = {};
  let stage = "searching" as never;
  let thrown: unknown = null;
  try {
    for (let i = 0; i < 30; i++) {
      const step = await advance(stage, state, aBusiness(), ctx);
      stage = step.stage as never;
      state = ownerAgrees(step) as RunState;
      if (stage === "done" || stage === "failed") break;
    }
  } catch (e) {
    thrown = e;
  }

  assert.equal(
    thrown,
    null,
    `the pipeline threw instead of failing cleanly: ${(thrown as Error)?.message}`,
  );
  assert.equal(stage, "failed");
  assert.doesNotMatch(state.reason ?? "", MACHINERY, state.reason ?? "");
});
