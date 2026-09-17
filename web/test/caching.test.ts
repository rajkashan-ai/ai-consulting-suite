import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sourceOf } from "./tool-source.ts";

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

test("only the shared half of a prompt is cached, never the varying half", () => {
  /**
   * The rule is the same as it always was: the breakpoint goes on a block that
   * stays identical between requests. What changed is that there is now such a
   * block inside the user message.
   *
   * Measured on 2026-09-17: the writing stage's two grid calls sent prompts of
   * 71,579 and 71,561 characters that differed by eighteen, and were billed
   * 35,998 and 36,002 input tokens. The shared part is `cachedPrefix` and it
   * carries the breakpoint. `prompt` is the part that differs and must never
   * carry one: caching a block that changes writes a new entry every time and
   * reads none, which is 1.25x to achieve nothing.
   */
  const think = engine.slice(engine.indexOf("think: async"));
  const messages = think.slice(think.indexOf("messages: ["), think.indexOf("}).finalMessage()"));

  // The breakpoint sits on the cached prefix.
  assert.match(
    messages,
    /text: cachedPrefix,\s*cache_control/,
    "the shared prefix is sent without a breakpoint, so nothing is ever cached",
  );

  // And nowhere near the block that differs between calls.
  const varying = messages.slice(messages.indexOf("{ type: \"text\" as const, text: prompt }"));
  assert.doesNotMatch(varying, /cache_control/, "the varying block carries a cache breakpoint");
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

/**
 * Which calls can actually use the cache, measured rather than assumed.
 *
 * On 2026-09-17 a run came back with cacheRead and cacheWritten both zero and I
 * reported caching as broken. It was not. The minimum cacheable prefix is 1,024
 * tokens on Sonnet and 512 on Opus, and below that nothing is cached and no
 * error is raised. Measured against our own prompts that day:
 *
 *     search call system        58 tokens   never cacheable
 *     listings call system     244 tokens   never cacheable
 *     battlecard rules       1,727 tokens   cacheable
 *
 * The run had failed at choosing and never reached the one stage that can use
 * it. So the zeros were correct and the wiring was right.
 *
 * This guards the only prompt that clears the bar. Trim it below and caching
 * stops silently, which is exactly the failure that cost an afternoon.
 */
test("the one cacheable prompt stays long enough to be cached", () => {
  // The whole tool, and the definition rather than the first mention, since an
  // import names it too.
  const tool = sourceOf("competitor-tracker");
  const from = tool.indexOf("export const BATTLECARD_RULES = `");
  assert.ok(from >= 0, "BATTLECARD_RULES is gone");

  const rules = tool.slice(from, tool.indexOf("`;", from));

  /**
   * The floor, from the measurement rather than from a rule of thumb.
   *
   * 4,688 characters measured as 1,727 tokens on 2026-09-17, so roughly 2.7
   * characters to a token, not the four I first assumed. The minimum cacheable
   * prefix on Sonnet is 1,024 tokens, about 2,800 characters. 3,500 sits above
   * that with room to edit, and well below where it is today.
   */
  assert.ok(
    rules.length > 3_500,
    `BATTLECARD_RULES is ${rules.length} characters. Below about 2,800 it stops being ` +
      `cacheable and nothing says so: no error is raised for a prefix under the minimum.`,
  );
});

test("the short prompts are not pretending to be cached", () => {
  // Adding a breakpoint to a 58 token prompt costs a write and never reads.
  // Recorded so nobody adds one thinking it was an oversight.
  const engine = readFileSync(join(import.meta.dirname, "..", "lib", "engine.ts"), "utf8");
  const search = engine.slice(engine.indexOf("search: async"), engine.indexOf("think: async"));
  assert.doesNotMatch(search, /cache_control/, "the search call's 58 token system prompt cannot be cached");
});

/**
 * The naming call has room to search out loud and then answer.
 *
 * Its cap was 1,500, set when it answered from memory in one short list. With
 * the search tool it narrates between searches, and on 2026-09-17 it produced
 * 4,859 tokens and was cut off. The engine treats a truncated answer as no
 * answer, rightly, so the run died having spent the searches.
 *
 * A smoke test twenty minutes earlier missed it because it ran on Haiku, which
 * wrote 469. Testing a cheaper model is testing a different model.
 */
test("the searching call can afford the answer it now produces", () => {
  const tool = sourceOf("competitor-tracker");
  const call = tool.slice(tool.indexOf("searchToolConfig(profile, 4)"));
  const cap = Number(/maxTokens:\s*([\d_]+)/.exec(call)?.[1]?.replace(/_/g, "") ?? 0);

  assert.ok(
    cap >= 6_000,
    `the naming call's cap is ${cap}. It produced 4,859 tokens on a real run and was cut off.`,
  );
});
