import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The tool screens, read as text.
 *
 * Every rule here is something that reached a customer's screen and broke it,
 * not a list of what could conceivably go wrong. The runner cannot load a .tsx,
 * so these read the source. That is weaker than rendering it and it is what
 * caught nothing at all before today.
 */

const here = import.meta.dirname;
const dir = join(here, "..", "app", "workspace", "[tool]");

const screens = readdirSync(dir)
  .filter((f) => f.endsWith(".tsx") && !f.startsWith("page"))
  .map((f) => ({ file: f, body: readFileSync(join(dir, f), "utf8") }));

/** Strip comments, so a rule cannot be satisfied by a sentence describing it. */
const code = (body: string) =>
  body.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/**
 * "Rendered fewer hooks than expected. This may be caused by an accidental
 * early return statement."
 *
 * A real crash, on a real run, on 2026-09-16. The tool screen returns a
 * different component from each branch into the same slot: a live progress
 * panel with five hooks, a finished card with none. When a run ended and the
 * page re-rendered, React reconciled them as the same element and threw onto
 * the customer's screen.
 *
 * It is worse than a broken page. The progress panel is what drives the run,
 * one step per request, so crashing it stops the run, and reloading starts a
 * brand new one from zero. That is how one St Albans run became two and
 * 434,000 tokens became 508,000.
 */
test("breakit: every branch of a tool screen is keyed, so React swaps rather than reconciles", () => {
  for (const { file, body } of screens) {
    const src = code(body);

    // Only screens that choose between components can hit this.
    const returns = src.match(/return\s*\(?\s*<[A-Z]/g) ?? [];
    if (returns.length < 2) continue;

    const keys = src.match(/key="/g) ?? [];
    assert.ok(
      keys.length >= returns.length,
      `${file}: ${returns.length} component branches and only ${keys.length} keys. ` +
        `Two branches sharing a slot are reconciled as one element, and the hook ` +
        `counts collide.`,
    );
  }
});

/**
 * A run's stored error is written for us. It says things like "an action was
 * not supported by its evidence", which is a sentence about our own checks, and
 * a salon owner can do nothing with it.
 */
test("breakit: no screen prints a run's raw error to the customer", () => {
  for (const { file, body } of screens) {
    const src = code(body);
    assert.doesNotMatch(
      src,
      /\{\s*(latest|run|last)\??\.error\s*\}/,
      `${file}: the run's own error text is rendered straight onto the page.`,
    );
  }
});

/**
 * A live, healthy run was framed in the red used for something going wrong now,
 * because of something that happened before it started.
 */
test("breakit: a previous failure is not dressed as a current one", () => {
  for (const { file, body } of screens) {
    const src = code(body);

    // Find any alarm-styled element and check no <Running> sits inside the same
    // returned fragment. A run in progress is not an error state.
    const alarmed = src.match(/className="[^"]*(auth__error|error|danger)[^"]*"[\s\S]{0,400}/g) ?? [];
    for (const block of alarmed) {
      assert.doesNotMatch(
        block,
        /<Running/,
        `${file}: a run in progress is shown under alarm styling.`,
      );
    }
  }
});
