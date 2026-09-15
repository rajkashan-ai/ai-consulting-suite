import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "libpg-query";

/**
 * The SQL parses against the real Postgres grammar.
 *
 * This is syntax, not behaviour: it cannot tell you a table is missing or a
 * column is misspelled. What it does catch is the thing that wastes the most
 * time, which is pasting a file into the Supabase SQL editor and having it
 * refuse at line 140 with nothing applied.
 */
const DIR = join(import.meta.dirname, "..", "supabase");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

test("there are SQL files to check", () => {
  assert.ok(files.length >= 3, `found ${files.length}`);
});

for (const file of files) {
  test(`${file} parses`, async () => {
    await pg.loadModule();
    const result = await pg.parse(readFileSync(join(DIR, file), "utf8"));
    assert.ok(result.stmts.length > 0, "no statements found");
  });
}

test("every table that is created also has row level security turned on", () => {
  // A table with RLS and no policy denies everything, which is safe. A table
  // with no RLS at all is readable by anyone holding the publishable key, which
  // is in every browser. This is the one that has to be right.
  const schema = readFileSync(join(DIR, "001_schema.sql"), "utf8");
  const created = [...schema.matchAll(/create table if not exists public\.(\w+)/g)].map(
    (m) => m[1],
  );
  assert.ok(created.length >= 6, `only found ${created.length} tables`);
  for (const table of created) {
    assert.match(
      schema,
      new RegExp(`alter table public\\.${table} enable row level security`),
      `public.${table} has no row level security`,
    );
  }
});
