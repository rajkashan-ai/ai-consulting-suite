import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RUNNABLE, TOOLS, runnerFor, toolBySlug } from "../tools/registry.ts";
import { READY } from "../app/workspace/[tool]/ready.ts";

/**
 * screens.tsx is read, not imported.
 *
 * `npm test` runs `node --test --experimental-strip-types`, which cannot load a
 * .tsx file at all: importing it passed when the file was run on its own under
 * tsx and failed the moment it joined the suite. Reading the source is what the
 * rest of these tests do with tsx, and it is the only thing that works in both.
 */
const screens = readFileSync(join(import.meta.dirname, "..", "app", "workspace", "[tool]", "screens.tsx"), "utf8");
const screenFor = (slug: string) =>
  new RegExp(`"${slug}":\\s*(\\w+)`).exec(screens)?.[1] ?? null;

/**
 * Two tools in one suite, sharing an engine, a workspace and a runs table.
 *
 * Each tool has its own tests for what it produces. This file is only about the
 * seams between them, which is where a second tool goes wrong: the same engine
 * advancing both, the same table holding both, the same page rendering both.
 *
 * The failure this guards against is not a blank screen. It is the Tracker's
 * panel rendering on the Planner's page, reading the Planner's runs and
 * starting a Tracker run on the first click, which looks exactly like success.
 */

const here = import.meta.dirname;
const built = TOOLS.filter((t) => t.built);

test("every built tool is complete on all four seams", () => {
  /**
   * A tool is wired when four separate things agree about it. Any one missing
   * is a screen that does nothing, or a run that starts and has nowhere to go.
   */
  for (const tool of built) {
    assert.ok(RUNNABLE[tool.slug], `${tool.slug}: registered as built with no runner`);
    assert.ok(runnerFor(tool.slug), `${tool.slug}: the engine cannot find its runner`);
    assert.ok(screenFor(tool.slug), `${tool.slug}: nothing to render`);
    assert.ok(READY[tool.slug], `${tool.slug}: no rule for when it can start`);
  }
  assert.equal(built.length, 2, "this file assumes two built tools; add the third here");
});

test("no tool is registered as built without being reachable", () => {
  // The other direction. A runner or a screen for a tool nobody can open is
  // dead code that looks live.
  for (const slug of Object.keys(RUNNABLE)) {
    assert.ok(toolBySlug(slug)?.built, `${slug} has a runner but is not built`);
  }
  for (const [, slug] of screens.matchAll(/"([a-z-]+)":\s*\w+,/g)) {
    assert.ok(toolBySlug(slug)?.built, `${slug} has a screen but is not built`);
  }
});

test("each tool answers to its own slug and nobody else's", () => {
  /**
   * The exact failure `tools/contract.ts` and `screens.tsx` were written to
   * stop. Asserted here rather than trusted, because it is invisible when it
   * breaks: the wrong tool runs and produces a plausible document.
   */
  for (const tool of built) {
    assert.equal(runnerFor(tool.slug)?.slug, tool.slug, `${tool.slug} is filed under another slug`);

    const others = built.filter((t) => t.slug !== tool.slug);
    for (const other of others) {
      assert.notEqual(
        screenFor(tool.slug),
        screenFor(other.slug),
        `${tool.slug} and ${other.slug} render the same screen`,
      );
    }
  }
});

test("a tool's screen never names another tool", () => {
  /**
   * Both screens read `documents` and `runs`, the same two tables, so the only
   * thing keeping them apart is the slug in every query. A screen that mentions
   * another tool's slug anywhere is either reading its rows or about to.
   *
   * Written first by slicing queries out with a regex that stopped at the first
   * semicolon. These queries sit inside a Promise.all, so one match spanned
   * several and found a correct slug somewhere in the middle: pointing the
   * Planner at the Tracker's documents did not fail it. This cannot miss that.
   */
  for (const tool of built) {
    const screen = readFileSync(join(here, "..", "app", "workspace", "[tool]", `${tool.slug}.tsx`), "utf8");

    for (const other of built.filter((t) => t.slug !== tool.slug)) {
      assert.ok(
        !screen.includes(other.slug),
        `${tool.slug}.tsx mentions ${other.slug}`,
      );
    }
  }
});

test("every query a screen makes says which tool and which business", () => {
  for (const tool of built) {
    const screen = readFileSync(join(here, "..", "app", "workspace", "[tool]", `${tool.slug}.tsx`), "utf8");

    /**
     * Each query on its own, not a count across the file.
     *
     * Counting was the first attempt and it could not fail: the file has more
     * mentions of workspace_id than it has queries, so deleting one scope left
     * the total still above the bar. A query is a chain, so its filters follow
     * it immediately; this takes the run of characters after each `.from(` and
     * requires both there.
     */
    const at = [...screen.matchAll(/\.from\("(documents|runs)"\)/g)];
    assert.ok(at.length > 0, `${tool.slug}: touches neither runs nor documents`);

    for (const [i, found] of at.entries()) {
      /**
       * Bounded at the next query, not at a fixed length.
       *
       * A 320 character window was the second attempt and it also could not
       * fail: it ran past the end of one query into the next, so deleting a
       * scope from the first was covered by the second one's. Each chain now
       * ends where the following `.from(` begins.
       */
      const ends = at[i + 1]?.index ?? screen.length;
      const chain = screen.slice(found.index!, ends);
      const writes = chain.includes(".insert(") || chain.includes(".upsert(");

      assert.match(
        chain,
        new RegExp(writes ? `tool: "${tool.slug}"` : `"tool", "${tool.slug}"`),
        `${tool.slug}: a query on ${found[1]} that does not say which tool`,
      );
      assert.match(
        chain,
        /workspace_id/,
        `${tool.slug}: a query on ${found[1]} not scoped to one business`,
      );
    }
  }
});

test("a tool that is not built says so rather than showing nothing", () => {
  // A screen that renders nothing and explains nothing reads as broken, and a
  // customer cannot tell "not written yet" from "it failed".
  const page = readFileSync(join(here, "..", "app", "workspace", "[tool]", "page.tsx"), "utf8");
  assert.match(page, /not built yet/i);

  for (const tool of TOOLS.filter((t) => !t.built)) {
    assert.equal(screenFor(tool.slug), null, `${tool.slug} is unbuilt and has a screen`);
  }
});

test("a hidden tool is still reachable by address, and still honest", () => {
  /**
   * Hidden means out of the navigation, not deleted. Somebody with the link,
   * or a bookmark from before, must not meet a crash.
   */
  for (const tool of TOOLS.filter((t) => t.hidden)) {
    assert.ok(toolBySlug(tool.slug), `${tool.slug} is hidden and unresolvable`);
    assert.equal(tool.built, false, "a hidden tool that is built would be unreachable by mistake");
  }
});

test("neither tool reads the other's folder", () => {
  // The parallel-sessions rule, checked across the two that exist rather than
  // in the abstract. `tools/sources` is shared data and is allowed.
  const SHARED = ["sources"];
  const dir = join(here, "..", "tools");
  const folders = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !SHARED.includes(n));

  for (const folder of folders) {
    for (const file of readdirSync(join(dir, folder)).filter((f) => f.endsWith(".ts"))) {
      const body = readFileSync(join(dir, folder, file), "utf8");
      for (const other of folders.filter((f) => f !== folder)) {
        assert.ok(
          !body.includes(`/${other}/`),
          `${folder}/${file} reaches into ${other}`,
        );
      }
    }
  }
});

test("the planner counts nothing off a platform we are asked not to read", () => {
  /**
   * Instagram's robots.txt is `User-agent: *` / `Disallow: /`. CLAUDE.md 1.5
   * rule 1 says robots is the gate and a block is never worked around.
   *
   * The spec said twice that we could count their posts, once wrongly claiming
   * we could not and once wrongly implying we may. The code never did it. This
   * keeps it that way, because the next session reads the spec.
   */
  const dir = join(here, "..", "tools", "content-social-planner");
  const source = readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");

  for (const platform of ["instagram.com", "facebook.com", "tiktok.com", "linkedin.com"]) {
    assert.ok(!source.includes(platform), `the planner fetches ${platform}`);
  }
});
