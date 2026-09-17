/**
 * How long does each step actually take?
 *
 *     npx tsx --env-file=.env.local --conditions=react-server \\
 *         scripts/time-a-run.ts <workspace-id> [tool-slug]
 *
 * WHY THIS EXISTS
 * Two live runs have ever succeeded, and both finished every step in well under
 * a minute. Every run that went long was killed. The step route is capped at 60
 * seconds, so the question "does a step take more than 60 seconds" decides
 * whether a live run can work at all, and nothing in the product measured it.
 *
 * This drives the engine directly, with no HTTP route and therefore no 60
 * second cap, so a step that would be killed in production runs to completion
 * here and says how long it needed. That is the measurement.
 */
const { createAdminClient } = await import("../lib/supabase/admin.ts");
const { step } = await import("../lib/engine.ts");

const workspaceId = process.argv[2];
const tool = process.argv[3] ?? "competitor-tracker";
/**
 * Stop once this stage has been reached, instead of running to the end.
 *
 *     ... <workspace-id> competitor-tracker listings
 *
 * For measuring one step rather than buying a whole run to see it. The search
 * step is the first thing a run does and costs about 68,000 input tokens; the
 * rest of the run costs about the same again and answers a different question.
 */
const stopAt = process.argv[4] ?? null;
if (!workspaceId) throw new Error("Which workspace? Pass its id.");

const db = createAdminClient();
const { data: ws } = await db.from("workspaces").select("name, town, website").eq("id", workspaceId).single();
if (!ws) throw new Error("No such workspace.");
console.log(`\n${ws.name ?? "(unnamed)"}, ${ws.town ?? "(no town)"} — ${ws.website}\n`);

/**
 * Carry on an unfinished run rather than starting a second one.
 *
 * One run at a time per workspace is a database constraint, so a run left
 * hanging blocks every later one. Resuming it is both what the product does and
 * the more useful measurement: this is the state a real customer comes back to.
 */
const { data: waiting } = await db
  .from("runs").select("id, stage").eq("workspace_id", workspaceId).eq("tool", tool)
  .not("stage", "in", "(done,failed)").limit(1);

let run = waiting?.[0] ?? null;
if (run) {
  console.log(`carrying on run ${run.id}, stuck at ${run.stage}\n`);
} else {
  const { data: made, error } = await db
    .from("runs").insert({ workspace_id: workspaceId, tool }).select("id, stage").single();
  if (error || !made) throw new Error(`Could not start a run: ${error?.message}`);
  run = made;
  console.log(`run ${run.id}\n`);
}

const steps: { stage: string; seconds: number }[] = [];
const began = Date.now();
let was = run.stage as string;

for (let n = 0; n < 60; n += 1) {
  const at = Date.now();
  // The stage we are about to spend the step in, not the one we land on. A
  // step is work done in the stage it started from, and recording the
  // destination credits every cost to the wrong stage.
  const spentIn = was;
  const moved = await step(run.id);
  const seconds = (Date.now() - at) / 1000;
  if (!moved) { console.log("nothing to do"); break; }
  was = moved.stage;
  steps.push({ stage: spentIn, seconds });
  if (stopAt && moved.stage === stopAt) {
    console.log(`\nstopped at ${stopAt}, as asked`);
    break;
  }
  if (moved.stage === "done" || moved.stage === "failed") {
    console.log(`\n${moved.stage.toUpperCase()}: ${moved.reason ?? moved.progress}`);
    break;
  }
}

const over = steps.filter((s) => s.seconds > 60);
console.log(`\n${steps.length} steps, ${((Date.now() - began) / 1000 / 60).toFixed(1)} minutes.`);
console.log(`Slowest step: ${Math.max(0, ...steps.map((s) => s.seconds)).toFixed(1)}s`);
console.log(`Steps over the 60 second route cap: ${over.length}`);
for (const s of over) console.log(`  ${s.stage}: ${s.seconds.toFixed(1)}s`);

export {};
