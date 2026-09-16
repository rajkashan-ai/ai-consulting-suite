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

test("the tick looks far enough back for a closed laptop", () => {
  /**
   * stalled_runs only returned runs started within the last hour, so the
   * scheduled tick, whose entire job is "close the tab and come back", quietly
   * abandoned anything older. Close a laptop at six and the run was dead by
   * seven with nothing saying so.
   *
   * How long a run may actually work is the watchdog's job now, and it measures
   * time spent working rather than time on the wall, so this window only has to
   * be generous enough for a laptop to be shut.
   */
  const sql = readFileSync(join(import.meta.dirname, "..", "supabase", "012_stalled_window.sql"), "utf8");
  assert.match(sql, /started_at > now\(\) - interval '24 hours'/);
  assert.doesNotMatch(sql, /interval '1 hour'/, "an hour is not long enough for a closed laptop");
});

test("the tick answers a scheduler's GET, not only a POST", () => {
  // Schedulers invoke a path with GET and put the secret in the header. With
  // only POST the cron would be configured, would look like it was running, and
  // would return 405 every minute into a log nobody reads. A tick that is
  // scheduled and does nothing is worse than none, because it looks handled.
  const route = readFileSync(join(import.meta.dirname, "..", "app", "api", "tick", "route.ts"), "utf8");
  assert.match(route, /export async function GET/);
  assert.match(route, /CRON_SECRET/, "the endpoint stopped being protected");
});

test("the tick is actually scheduled, not just built", () => {
  // It was built, protected and correct, and nothing ever called it.
  const cron = JSON.parse(readFileSync(join(import.meta.dirname, "..", "vercel.json"), "utf8"));
  const tick = (cron.crons ?? []).find((c: { path: string }) => c.path === "/api/tick");
  assert.ok(tick, "nothing schedules the tick");
  assert.equal(tick.schedule, "* * * * *");
});
