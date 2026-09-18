#!/usr/bin/env node
/**
 * Let the Competitor Tracker look again before its seven days are up.
 *
 * WHY THIS EXISTS
 * The tracker holds a hard weekly rule: competitor-tracker.tsx reads the latest
 * stored document's date and refuses a fresh look inside seven days. That rule
 * is right for a customer, who should not pay for the same answer twice in a
 * week. It is wrong for us on a day we have just fixed what the tool was doing
 * wrong, because the cached answer is the broken one.
 *
 * WHAT IT DELETES, AND WHAT IT DOES NOT
 * Documents only, for one workspace, for this one tool. Every run row stays,
 * which is where the read pages and the state live, so the evidence of what
 * happened is not lost. Nothing else in the database is touched.
 *
 * A backup of both the documents and the runs is written first, next to this
 * file under ../backups/, and the script refuses to delete if that fails.
 *
 *     node refresh-tracker.mjs            say what it would delete, change nothing
 *     node refresh-tracker.mjs --confirm  take the backup, then delete
 *
 * Then open the tracker in the browser. Loading the page starts the run.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const WORKSPACE = "5f42eff6-7536-4f13-83d7-a0a841750f1b"; // A Cut Above St Albans
const TOOL = "competitor-tracker";
const confirm = process.argv.includes("--confirm");

const HERE = import.meta.dirname;
const env = Object.fromEntries(
  readFileSync(join(HERE, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: docs, error: reading } = await db
  .from("documents")
  .select("id, created_at")
  .eq("workspace_id", WORKSPACE)
  .eq("tool", TOOL)
  .order("created_at", { ascending: false });

if (reading) {
  console.error(`Could not read the documents: ${reading.message}`);
  process.exit(1);
}

console.log(`workspace ${WORKSPACE}`);
console.log(`tool      ${TOOL}`);
console.log(`\n${docs.length} document${docs.length === 1 ? "" : "s"} would be deleted:`);
for (const d of docs) console.log(`   ${d.created_at.slice(0, 19)}  ${d.id}`);
console.log(`\nRuns are not touched.`);

if (!confirm) {
  console.log(`\nNothing changed. Run again with --confirm to do it.`);
  process.exit(0);
}

/* The backup has to succeed before anything is removed. A delete whose backup
   silently failed is the same as a delete with no backup. */
const { data: full } = await db.from("documents").select("*").eq("workspace_id", WORKSPACE).eq("tool", TOOL);
const { data: runs } = await db.from("runs").select("*").eq("workspace_id", WORKSPACE).eq("tool", TOOL);

const dir = join(HERE, "..", "backups");
mkdirSync(dir, { recursive: true });
const out = join(dir, `${TOOL}-${WORKSPACE.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify({ takenAt: new Date().toISOString(), workspace: WORKSPACE, documents: full, runs }, null, 2));
console.log(`\nbacked up ${full.length} documents and ${runs.length} runs to ${out}`);

const { data: gone, error } = await db
  .from("documents")
  .delete()
  .eq("workspace_id", WORKSPACE)
  .eq("tool", TOOL)
  .select("id");

if (error) {
  console.error(`\nDelete failed, nothing removed: ${error.message}`);
  process.exit(1);
}

console.log(`deleted ${gone.length} documents`);
console.log(`\nOpen the tracker and it will start a fresh run:`);
console.log(`   http://localhost:3000/workspace/competitor-tracker?w=${WORKSPACE}`);
