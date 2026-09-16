#!/usr/bin/env node
/**
 * Apply every SQL file that has not been applied yet.
 *
 *     npm run db          apply what is missing
 *     npm run db -- --check   say what is missing, change nothing
 *
 * WHY THIS EXISTS
 * On 15 September a dry run failed on its first line because four SQL files had
 * never been run. Everything built that afternoon was sitting in the repository
 * against a database that did not have the columns, and nothing said so. A file
 * existing is not a file having been run, and the difference was invisible.
 *
 * Every file is written to be safe to run twice: create if not exists, create
 * or replace, add column if not exists. So a file whose contents have changed is
 * applied again rather than skipped, and that is the point of recording a hash
 * rather than only a name.
 *
 * It goes through the Supabase CLI on the linked project, which needs no
 * database password: the access token from `supabase login` is enough.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dirname;
const DIR = join(HERE, "supabase");
const check = process.argv.includes("--check");

/**
 * Run SQL, and decide for ourselves whether it worked.
 *
 * The Supabase CLI exits 0 when the SQL fails. It prints the error as JSON on
 * stdout and returns success, so anything trusting the exit code reports
 * "applied" for a statement the database refused. Every apply message before
 * this was checked that way and proved nothing.
 */
function sql(text) {
  let out = "";
  try {
    out = execFileSync("npx", ["supabase", "db", "query", "--linked"], {
      cwd: HERE,
      input: text,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (e) {
    out = String(e.stdout ?? "") + String(e.stderr ?? "");
  }

  const failed = out.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (out.includes('"_tag":"Error"') && failed) {
    const said = failed[1].replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\s+/g, " ");
    throw new Error(said.trim());
  }
  return out;
}

/**
 * Applied in name order, and the name decides who collides with whom.
 *
 * A shared running number, 011 then 012 then 013, means two people building two
 * tools in two sessions both write 013 and one of them silently loses. Name a
 * migration for the tool and the day instead:
 *
 *   competitor-tracker-2026-09-17-retry.sql
 *   content-planner-2026-09-17-drafts.sql
 *
 * Two sessions cannot pick the same name, the order is still stable, and the
 * file says which tool owns it. The numbered ones already applied keep their
 * names: renaming them would make every one look unapplied and run again.
 */
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// The table that records the others has to exist before it can record anything.
const bootstrap = files.find((f) => f.includes("migrations"));
if (bootstrap) {
  try {
    sql(readFileSync(join(DIR, bootstrap), "utf8"));
  } catch (e) {
    console.error(`\nCould not reach the database.\n${String(e.stderr ?? e.message).slice(0, 300)}\n`);
    console.error("Run `npx supabase login` and `npx supabase link` first.\n");
    process.exit(1);
  }
}

let applied = new Map();
try {
  const out = sql("select filename, sha from public.schema_migrations;");
  const rows = JSON.parse(out.slice(out.indexOf("{"))).rows ?? [];
  applied = new Map(rows.map((r) => [r.filename, r.sha]));
} catch {
  // First ever run. Nothing applied, which is the honest answer.
}

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

const todo = files.filter((f) => {
  const text = readFileSync(join(DIR, f), "utf8");
  return applied.get(f) !== sha(text);
});

if (!todo.length) {
  console.log(`\n  All ${files.length} files applied and unchanged.\n`);
  process.exit(0);
}

if (check) {
  console.log(`\n  ${todo.length} file(s) not applied, or changed since they were:\n`);
  todo.forEach((f) => console.log(`    ${applied.has(f) ? "changed" : "never run"}   ${f}`));
  console.log(`\n  Run: npm run db\n`);
  process.exit(1);
}

console.log("");
for (const f of todo) {
  const text = readFileSync(join(DIR, f), "utf8");
  process.stdout.write(`  ${f.padEnd(30)}`);
  try {
    sql(text);
    sql(
      `insert into public.schema_migrations (filename, sha, applied_at)
       values ('${f}', '${sha(text)}', now())
       on conflict (filename) do update set sha = excluded.sha, applied_at = now();`,
    );
    console.log("applied");
  } catch (e) {
    console.log("FAILED\n");
    // The sentence Postgres wrote, not a stack trace naming this file.
    console.error(`  ${e.message.slice(0, 400)}\n`);
    console.error(`  Nothing after ${f} was run.\n`);
    process.exit(1);
  }
}
console.log("\n  Done.\n");
