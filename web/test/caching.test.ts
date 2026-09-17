import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Prompt caching, as it is wired rather than as it is hoped for.
 *
 * Verified live on 2026-09-17 with our own system prompt shape: the first call
 * wrote 6,852 tokens and the second read all 6,852 back. A cache read is a
 * tenth of base input and a write is one and a quarter times, so this only
 * pays when the same prefix is reused, which is why what is cached matters as
 * much as that anything is.
 *
 * Read as source, because the engine is server-only and cannot be imported by
 * the test runner.
 */

const engine = readFileSync(
  join(import.meta.dirname, "..", "lib", "engine.ts"),
  "utf8",
);

test("the system prompt is cached", () => {
  // The documented rule: the breakpoint goes on the last block that stays
  // identical between requests. A tool's rules do not change between the calls
  // of one run, and the tracker's writing stage alone sends them three times.
  const think = engine.slice(engine.indexOf("think: async"));
  assert.match(think, /system: \[\{[^]*cache_control/, "the system prompt is sent uncached");
});

test("the prompt is not cached", () => {
  /**
   * It carries the evidence, which differs in every run and mostly between the
   * calls of one run. Caching a block that changes writes a new entry every
   * time and reads none: 1.25x to achieve nothing.
   */
  const think = engine.slice(engine.indexOf("think: async"));
  const messages = think.slice(think.indexOf("messages: ["), think.indexOf("}).finalMessage()"));
  assert.doesNotMatch(messages, /cache_control/, "the varying block carries a cache breakpoint");
});

test("what the cache did is recorded, separately from ordinary input", () => {
  /**
   * Recorded because the documentation is explicit that a prefix below the
   * model's minimum is not cached and raises no error. Without these numbers,
   * "caching saved us x" is arithmetic on a guess.
   *
   * Kept apart from `input` because they are billed apart. A total that mixed
   * a tenth-price read with a base-price token answers no question.
   */
  assert.match(engine, /cache_creation_input_tokens/, "cache writes are not counted");
  assert.match(engine, /cache_read_input_tokens/, "cache reads are not counted");

  const watchdog = readFileSync(join(import.meta.dirname, "..", "lib", "watchdog.ts"), "utf8");
  assert.match(watchdog, /cacheWritten/);
  assert.match(watchdog, /cacheRead/);
  assert.doesNotMatch(
    watchdog,
    /input: had\.input \+ spentHere\.input \+ /,
    "cache tokens were folded into the input total",
  );
});

test("both model call sites count the cache, not just one", () => {
  // The search call and the thinking call are separate. Counting one and not
  // the other would produce a number that looks measured and is half missing.
  const counts = engine.match(/countCache\(/g) ?? [];
  assert.ok(counts.length >= 3, `countCache appears ${counts.length} times, expected its definition plus both call sites`);
});
