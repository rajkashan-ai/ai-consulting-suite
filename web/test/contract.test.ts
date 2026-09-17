import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RUNNABLE, TOOLS, runnerFor } from "../tools/registry.ts";

/**
 * Can six tools be built by six sessions without colliding?
 *
 * They could not. The engine imported the Competitor Tracker by name: its
 * stages, its playbook, its document, and its slug hardcoded into the row it
 * wrote. Every new tool therefore meant editing the engine, so two people
 * building two tools collided on their first commit.
 *
 * The engine now looks the tool up by the slug already on the run and calls
 * whatever it finds. A session building a tool touches its own folder and one
 * line of the registry.
 */

const here = import.meta.dirname;
const engine = readFileSync(join(here, "..", "lib", "engine.ts"), "utf8");

test("the engine names no tool", () => {
  // The whole point. If this fails, building the next tool means editing the
  // engine again and the collision is back.
  for (const tool of TOOLS) {
    assert.doesNotMatch(
      engine,
      new RegExp(tool.slug),
      `the engine still names ${tool.slug}`,
    );
  }
});

test("the engine imports no tool's own files", () => {
  const imports = [...engine.matchAll(/from "(@\/tools\/[^"]+)"/g)].map((m) => m[1]);
  const allowed = ["@/tools/registry", "@/tools/contract", "@/tools/types"];

  for (const i of imports) {
    assert.ok(allowed.includes(i), `the engine reaches inside a tool: ${i}`);
  }
});

test("a tool that can run is reachable by its slug alone", () => {
  const runner = runnerFor("competitor-tracker");
  assert.ok(runner, "the tracker is not reachable through the registry");
  assert.equal(runner!.slug, "competitor-tracker");
});

test("a tool nobody has written yet fails politely rather than crashing", () => {
  // Most of the six are like this, and a customer opening one must not see a
  // stack trace.
  //
  // The unwritten tool is found rather than named. This said
  // "content-social-planner", which was true until somebody wrote it, and then
  // the test failed for the one reason that is not a fault: the thing it used
  // as an example of nothing stopped being nothing.
  const unwritten = TOOLS.find((t) => !t.built);
  assert.ok(unwritten, "every tool is built, so this can no longer be tested");
  assert.equal(runnerFor(unwritten.slug), null);
  assert.match(engine, /This tool cannot run yet/);
});

test("everything that claims to be built can actually run", () => {
  // The registry says built: true and the engine looks for a runner. If those
  // two disagree, the tool is unopenable and nothing says why.
  for (const tool of TOOLS.filter((t) => t.built)) {
    assert.ok(RUNNABLE[tool.slug], `${tool.slug} says built but has no runner`);
  }
});

test("every runner provides the whole contract", () => {
  for (const [slug, runner] of Object.entries(RUNNABLE)) {
    for (const part of ["advance", "buildBody", "hollow", "title"]) {
      assert.equal(typeof (runner as never)[part], "function", `${slug} has no ${part}`);
    }
    assert.equal(runner.slug, slug, `${slug} is filed under the wrong key`);
  }
});

test("a document is named and filed by the tool, not by the engine", () => {
  assert.match(engine, /tool: tool\.slug/);
  assert.match(engine, /title: tool\.title\(/);
});

test("no tool reaches into another tool", () => {
  /**
   * The second half of building in parallel. One tool importing another's
   * files makes two sessions dependent on each other again, quietly, without
   * either editing a shared file.
   */
  /**
   * Not every folder under tools/ is a tool. `sources/` is seed data about the
   * UK web that any tool may read and none of them owns, the same as
   * categories.ts beside it. Listing the shared ones by name means adding one
   * is a deliberate act rather than a way round this test.
   */
  const SHARED = ["sources"];

  const toolsDir = join(here, "..", "tools");
  const folders = readdirSync(toolsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !SHARED.includes(name));

  const offenders: string[] = [];

  for (const folder of folders) {
    const dir = join(toolsDir, folder);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const body = readFileSync(join(dir, file), "utf8");
      for (const other of folders.filter((f) => f !== folder)) {
        if (body.includes(`/${other}/`)) offenders.push(`${folder}/${file} reaches into ${other}`);
      }
    }
  }

  assert.deepEqual(offenders, [], offenders.join("\n  "));
});

/**
 * No test reads a tool's source or spec by filename.
 *
 * Three times in two days, the same afternoon each time. The Tracker's prompts
 * moved out of stages.ts and six tests failed. The Planner's spec was split and
 * four more did. None of them was wrong about the product: each was checking
 * "the tool says X" or "the spec says X" and had written down a filename
 * instead, so a file moving looked like a rule breaking.
 *
 * Fixing the instances three times is not fixing it. `sourceOf` reads a tool's
 * whole folder and `specOf` reads a CLAUDE.md with its references, and this
 * stops the next person reaching past them, including me.
 *
 * Fixtures stay exempt. A fixture is a specific file by design, and reading a
 * folder to find one would be wrong.
 */
test("no test pins itself to a tool's filename", () => {
  const dir = join(here, "..", "test");
  const offenders: string[] = [];

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".test.ts"))) {
    const body = readFileSync(join(dir, file), "utf8");

    /**
     * The call, not the line.
     *
     * Written line by line first, and a `readFileSync(` with its path on the
     * next line walked straight through it: that is how these are usually
     * formatted once the path is long, which is exactly when somebody reaches
     * for a filename. The window is the call and its arguments.
     */
    for (const found of body.matchAll(/readFileSync\(/g)) {
      const call = body.slice(found.index!, found.index! + 200);
      if (call.includes("fixtures")) continue;

      /**
       * A named file inside one tool's own folder, and nothing else.
       *
       * Three things are not this and were flagged by a cruder version:
       * a walker whose path is a variable, which is the right pattern; a
       * cross-check that two implementations of the same rule agree, where
       * naming both files is the point; and `tools/categories.ts`, which is
       * shared between tools rather than owned by one.
       */
      const insideOneTool = TOOLS.some(
        (t) => call.includes(`"${t.slug}"`) || call.includes(`/${t.slug}/`),
      );
      const namesAFile = /"[\w.-]+\.tsx?"/.test(call);

      if (insideOneTool && namesAFile) {
        offenders.push(`${file}:${body.slice(0, found.index!).split("\n").length}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These read a tool's source or spec by filename:\n  ${offenders.join("\n  ")}\n` +
      `Use sourceOf(tool) or specOf(tool) from test/tool-source.ts. What the test means is ` +
      `"somewhere in this tool", and a declaration moving between files is not a rule breaking.`,
  );
});

/**
 * `npm test` never costs money and never reaches the internet.
 *
 * The moment one file in test/ is neither, the suite stops being something
 * anybody runs on every commit, and a suite nobody runs is worse than none
 * because it still looks like cover. Anything that talks to a real service
 * lives in smoke/ and runs only when asked.
 */
test("no test in the free suite reaches a real service", () => {
  const dir = join(here, "..", "test");
  const offenders: string[] = [];

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".test.ts"))) {
    const body = readFileSync(join(dir, file), "utf8");
    const src = body.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

    /**
     * Imports and calls, not mentions.
     *
     * Written as plain word matches first, and it flagged two files that read
     * source text looking for those very words, including itself. A test that
     * inspects a file for "createAdminClient" is not connecting to anything;
     * one that imports it is.
     */
    const imports = src.match(/^import .*$/gm)?.join("\n") ?? "";

    for (const [what, sign, where] of [
      ["the Anthropic SDK", /@anthropic-ai\/sdk/, imports],
      ["the database", /supabase\/(admin|server|client)/, imports],
      ["a live fetch", /\bfetch\(\s*["'`]https?:/, src],
      ["the API key", /process\.env\.ANTHROPIC_API_KEY/, src],
    ] as const) {
      if (sign.test(where)) offenders.push(`${file} reaches ${what}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `${offenders.join("\n  ")}\nPut it in smoke/ and run it with npm run smoke.`,
  );
});

test("the smoke suite is gated out of the free one", () => {
  const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));

  assert.match(pkg.scripts.test, /test\/\*\.test\.ts/, "npm test must name only test/");
  assert.doesNotMatch(pkg.scripts.test, /smoke/, "npm test would spend money");
  assert.ok(pkg.scripts.smoke, "there is no way to run the smoke tests deliberately");
});
