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

test("a tool nobody has written a rule for cannot start", () => {
  const full: Workspace = { id: "w", name: "X", website: "https://x.test", trade: "barber", town: "S" };
  assert.equal(readyFor("nothing-like-this", full), false, "silence read as permission");
});
