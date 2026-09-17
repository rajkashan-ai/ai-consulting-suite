import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOLS } from "../tools/registry.ts";
import { READY, readyFor, type Workspace } from "../app/workspace/[tool]/ready.ts";

/**
 * The screen names no tool, the same way the engine names no tool.
 *
 * `test/contract.test.ts` proves the engine was fixed. It reads `lib/engine.ts`
 * and nothing else, so the identical coupling one layer up went unnoticed: the
 * tool page imported the Competitor Tracker by name and rendered it for any
 * tool marked built. Turning on the second tool would have shown the Tracker's
 * panel on the Planner's page, queried the Tracker's runs, and started a
 * Tracker run on the first click — a failure that looks exactly like success.
 *
 * Fixing one file is not the point. A rule enforced on one of two places is a
 * rule that holds until somebody builds the third.
 */

const here = import.meta.dirname;
const page = readFileSync(join(here, "..", "app", "workspace", "[tool]", "page.tsx"), "utf8");
/* Read as text, not imported: the test runner cannot load a .tsx. The rules
   that decide anything live in ready.ts, which it can. */
const screens = readFileSync(join(here, "..", "app", "workspace", "[tool]", "screens.tsx"), "utf8");

test("the tool page names no tool", () => {
  for (const tool of TOOLS) {
    assert.doesNotMatch(page, new RegExp(tool.slug), `the page still names ${tool.slug}`);
  }
});

test("the tool page imports no tool's own screen", () => {
  const imports = [...page.matchAll(/from "\.\/([a-z-]+)"/g)].map((m) => m[1]);
  /* Shared files the page may reach for. A tool's own screen is never on
     this list, which is the whole assertion: widening it to let `screens` and
     `ready` through is not the same as widening it to let a tool through. */
  const allowed = ["screens", "ready", "tabs", "mark", "running"];
  for (const i of imports) {
    assert.ok(allowed.includes(i), `the page reaches straight for a tool's screen: ${i}`);
  }
});

test("everything that claims to be built has a screen and a rule to start it", () => {
  for (const tool of TOOLS.filter((t) => t.built)) {
    assert.match(screens, new RegExp(`"${tool.slug}":`), `${tool.slug} says built but has no screen`);
    assert.ok(READY[tool.slug], `${tool.slug} says built but nothing says when it can start`);
  }
});

test("every tool answers whether it can start, in its own terms", () => {
  const full: Workspace = { id: "w", name: "X", website: "https://x.test", trade: "barber", town: "Shrewsbury" };
  const siteOnly: Workspace = { ...full, trade: null, town: null };

  for (const slug of Object.keys(READY)) {
    assert.equal(readyFor(slug, full), true, `${slug} refuses a workspace that has everything`);
    assert.equal(
      readyFor(slug, { ...full, website: "" }),
      false,
      `${slug} would start with no website, and every tool reads one`,
    );
  }

  /**
   * The two tools genuinely differ here, and a single shared condition would
   * block the Planner on a trade it does not use. Asserted rather than assumed,
   * because "they happen to be the same today" is how the shared condition
   * comes back.
   */
  assert.equal(readyFor("competitor-tracker", siteOnly), false);
  assert.equal(readyFor("content-social-planner", siteOnly), true);
});

test("the screen every run shares says nothing about any one tool's work", () => {
  /**
   * The running screen announced "looking for who you are up against" and
   * "we find up to five competitors" for whatever was running. The Content
   * Planner reads the owner's own site and researches nobody, so its first
   * screen told them we were looking at their rivals.
   *
   * Third instance of one defect: the engine named a tool, the page named a
   * tool, and the shared progress screen described one tool's work. Each was
   * found separately, which is the argument for the rule rather than the fix.
   */
  /* Comments stripped. A comment recording that this file used to describe one
     tool's work is not the file describing it. */
  const running = readFileSync(join(here, "..", "app", "workspace", "[tool]", "running.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const word of ["competitor", "battlecard", "rival", "up against", "posts", "cadence"]) {
    assert.doesNotMatch(running, new RegExp(word, "i"), `the shared progress screen says "${word}"`);
  }
  for (const tool of TOOLS) {
    assert.doesNotMatch(running, new RegExp(tool.slug), `the shared progress screen names ${tool.slug}`);
  }
});

test("every tool that can run says what it is doing while it runs", () => {
  /* An empty opening is a blank panel for the first twelve seconds, which
     reads as broken. Checked as text because these are .tsx. */
  for (const tool of TOOLS.filter((t) => t.built)) {
    const file = readFileSync(join(here, "..", "app", "workspace", "[tool]", `${tool.slug}.tsx`), "utf8");
    assert.match(file, /const OPENING = \{/, `${tool.slug} has no opening line`);
    assert.match(file, /opening=\{OPENING\}/, `${tool.slug} does not pass its opening to Running`);
    const doing = file.match(/doing:\s*"([^"]+)"/)?.[1] ?? "";
    assert.ok(doing.length > 10, `${tool.slug} says nothing while it runs`);
  }
});

test("a tool nobody has written a rule for cannot start", () => {
  const full: Workspace = { id: "w", name: "X", website: "https://x.test", trade: "barber", town: "S" };
  assert.equal(readyFor("nothing-like-this", full), false, "silence read as permission");
});
