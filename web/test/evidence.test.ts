/**
 * Evidence is visible, or it is not evidence.
 *
 * The handoff of 2026-09-18: "Always visible. Never inside a disclosure or
 * tooltip. This is the product's differentiator; hiding it removes it."
 *
 * It was a collapsed <details>, and the reason written beside it was "they see
 * the point, and open it if they want to argue with it". Nobody opens a
 * disclosure to check something they already believe, so the evidence was read
 * only by people who had already decided we were wrong.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const screen = (f: string) =>
  readFileSync(join(import.meta.dirname, "..", "app", "workspace", "[tool]", f), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

test("the battlecard's evidence is not behind a disclosure", () => {
  /* Comments stripped: this file explains the disclosure it removed, and a
     guard that fires on its own explanation can never pass. Fifth time. */
  const card = code(screen("battlecard.tsx"));
  assert.doesNotMatch(card, /<details>|<summary/, "the evidence went back into a disclosure");
  assert.match(card, /<Evidence\b/, "nothing renders the evidence at all");
});

test("a claim with no source says so rather than going quiet", () => {
  const card = code(screen("battlecard.tsx"));
  /* The ternary that decides the stamp: a source makes it src, nothing makes
     it ours. A claim with neither would simply vanish, which is the failure
     this stamp exists to stop. */
  assert.match(card, /claim\.source \? \("src" as const\) : \("ours" as const\)/);
  assert.match(card, /our read of the pages/, "an unsourced claim is left blank");
});

test("the two kinds are told apart by more than colour", () => {
  /* brand.css rule 4: colour is never the only signal. The stamp prints the
     word `src` or `ours` beside the rule, so it survives being printed, being
     read aloud, and being looked at by somebody who cannot tell green from
     berry. */
  const ev = screen("evidence.tsx");
  assert.match(ev, /\{kind\}/, "the kind is drawn as a colour and never as a word");
  assert.match(ev, /stamp--\$\{kind\}/);
});

test("nothing is stamped when there is nothing to stamp", () => {
  /* An empty "what this is based on" implies evidence exists and is missing,
     which is worse than no heading. */
  const ev = code(screen("evidence.tsx"));
  assert.match(ev, /if \(!stamps\.length\) return null;/);
});

test("the pulse says what is happening and never how far through", () => {
  const p = code(screen("pulse.tsx"));
  assert.match(p, /\{doing\}/, "the sentence is not shown");
  assert.doesNotMatch(p, /percent|%|value|max=|progress(bar|Bar)/, "it claims a fraction");
});

test("charge lime is the live-agent colour and marks nothing else", () => {
  /**
   * The handoff's second colour rule. Lime means an agent is running right
   * now; it never marks data. Checked across the stylesheet rather than in one
   * component, because the way this rule breaks is somebody reaching for the
   * brightest token to make a number stand out.
   */
  const css = readFileSync(join(import.meta.dirname, "..", "app", "design.css"), "utf8");
  const users = [...css.matchAll(/^([^{}\n]+)\{[^}]*var\(--charge\)[^}]*\}/gm)].map((m) => m[1].trim());
  for (const sel of users) {
    assert.ok(
      /pulse/.test(sel),
      `--charge is on "${sel}", which is not an agent-is-running state`,
    );
  }
  assert.ok(users.length > 0, "nothing uses the live-agent colour, so the dot is not lit");
});

test("the word on a stamp is readable, not just the rule beside it", () => {
  /**
   * The handoff names #1F7A4D for stamps and gives no contrast figure for it.
   * On the app ground it is 3.29:1: fine for a 2px rule, which needs 3, and a
   * failure for the word "src" at 9.5px, which needs 4.5. Caught by sweeping
   * the rendered page, not by reading the spec.
   */
  const css = readFileSync(join(import.meta.dirname, "..", "app", "design.css"), "utf8");
  assert.match(css, /--source-lift:#35AE71/, "the lifted green is gone");
  assert.match(
    css,
    /\.stamp--src \.stamp__k\{color:var\(--source-lift\)\}/,
    "the stamp's word is back on the 3.29:1 green",
  );
  assert.match(css, /\.stamp--src\{border-left-color:var\(--source\)\}/, "the rule lost the handoff's green");
});
