import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { TOOLS, toolBySlug } from "../tools/registry.ts";

test("every tool has a slug that works as a web address", () => {
  for (const t of TOOLS) assert.match(t.slug, /^[a-z][a-z0-9-]*$/, t.slug);
  assert.equal(new Set(TOOLS.map((t) => t.slug)).size, TOOLS.length);
});

test("a tool marked built has something to run", () => {
  // built:true with no run() is a page that opens and then does nothing, which
  // reads to a customer as broken.
  for (const t of TOOLS) {
    if (t.built) assert.ok(t.run || t.slug === "competitor-tracker", `${t.slug} says built`);
  }
});

test("every tool matches a folder in Agents", () => {
  // CLAUDE.md 1.3: one internal name per tool, so there is only ever one name
  // to search for. A rename on one side and not the other breaks that quietly.
  const folders = readdirSync(join(import.meta.dirname, "..", "..", "Agents"), {
    withFileTypes: true,
  })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""));

  for (const t of TOOLS) {
    const match = folders.some((f) => f.startsWith(t.slug.split("-")[0]));
    assert.ok(match, `${t.slug} has no folder in Agents. Folders: ${folders.join(", ")}`);
  }
});

test("an unknown slug returns nothing rather than the first tool", () => {
  assert.equal(toolBySlug("nonsense"), undefined);
  assert.equal(toolBySlug("competitor-tracker")?.name, "Competitor Tracker");
});

test("every tool says what it does, for the screen that has nothing to show", () => {
  for (const t of TOOLS) {
    assert.ok(t.does.length > 20, `${t.slug} needs a real line`);
    assert.ok(!t.does.includes("--"), `${t.slug}: no em dashes`);
  }
});
