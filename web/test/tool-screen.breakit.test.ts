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

/**
 * No hook is declared after a return.
 *
 * "Rendered fewer hooks than expected. This may be caused by an accidental
 * early return statement." React names the cause in its own second sentence,
 * and it reached a customer's screen twice on 2026-09-17.
 *
 * The first time I diagnosed it as a reconciliation problem and added keys to
 * the parent's branches. That was wrong, it did not fix it, and the same
 * message came back on the next real run. The actual cause was two hooks
 * sitting below an `if (failed) return` in running.tsx: seven hooks on a normal
 * render, five on a failed one, so the crash fired exactly when a run failed.
 *
 * It takes down more than the page. That component drives the run, one request
 * per step, so the crash stops the run and reloading starts a new one from
 * zero.
 */
test("breakit: no client component declares a hook after a return", () => {
  const HOOK = /\b(useState|useEffect|useRef|useMemo|useCallback|useRouter|useTransition|useActionState)\s*[(<]/;
  const offenders: string[] = [];

  for (const { file, body } of screens) {
    if (!/^["']use client["']/m.test(body)) continue;

    const raw = body.split("\n");
    const lines = code(body).split("\n");

    const starts = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => /^(export )?(default )?function [A-Z]/.test(line))
      .map(({ i }) => i);

    for (const [n, from] of starts.entries()) {
      const to = starts[n + 1] ?? lines.length;

      /**
       * A return that exits the component, told apart by scope rather than by
       * indentation.
       *
       * Indentation cannot do it. Two spaces misses `if (failed) { return`,
       * which is the bug this was written for. Four spaces catches that and
       * also catches every `useEffect` cleanup, which is a return inside a
       * callback and exits nothing.
       *
       * So: walk the body tracking which open braces belong to a nested
       * function. A return counts only when none of the blocks around it is
       * one, and a hook counts only when it sits directly in the component.
       */
      const opens: boolean[] = [];   // true when a brace opened a function scope
      let exited = false;

      for (let i = from + 1; i < to; i += 1) {
        const line = lines[i];
        const inFunction = opens.some(Boolean);

        if (!inFunction && /^\s*return[\s(;]/.test(line)) exited = true;

        if (!inFunction && exited && HOOK.test(line)) {
          const real = raw.findIndex((l, j) => j > from && l.trim() === line.trim());
          offenders.push(`${file}:${real >= 0 ? real + 1 : "?"}  ${line.trim().slice(0, 56)}`);
        }

        for (const ch of line) {
          if (ch === "{") opens.push(/=>|function\s*\(/.test(line));
          else if (ch === "}") opens.pop();
        }
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Hooks below a return, inside the same component:\n  ${offenders.join("\n  ")}\n` +
      `React runs fewer of them on the render that takes the early exit, and throws.`,
  );
});
