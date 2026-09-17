"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { asChosen, wrongWith, type Offer } from "@/tools/competitor-tracker/shortlist";

/**
 * Store who the owner says they compete with.
 *
 * This is the boundary. The names arrive from a browser and end up in a fetch
 * queue, so nothing here trusts them: the list we offered is read back from the
 * run itself and anything not on it is dropped. A name we never offered is a
 * name whose country and trade were never established, and fetching it would
 * walk around every filter behind this screen.
 *
 * Read through the caller's own session, never the admin client, so row level
 * security decides which runs they can see. A run belonging to somebody else
 * comes back as nothing, which is the same answer as a run that does not exist,
 * and that is the right answer: it does not tell them which.
 */
export async function chooseCompetitors(
  runId: string,
  names: string[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in and try again." };

  const { data: run, error: lookingUp } = await supabase
    .from("runs")
    .select("id, stage, state, workspace_id")
    .eq("id", runId)
    .maybeSingle();

  if (lookingUp) {
    // Recorded rather than swallowed: a read that fails is our fault and the
    // owner can do nothing about it, so they get a plain sentence and we get
    // the reason. CLAUDE.md 1.4c, and CWE-390.
    console.error(`[picker] could not read run ${runId}: ${lookingUp.message}`);
    return { error: "We could not save that. Try again in a moment." };
  }
  if (!run) return { error: "That run is not there any more. Start it again." };

  if (run.stage !== "picking") {
    // Already moved on, by their other tab or by the scheduled tick. Saying so
    // beats writing a choice into a run that has finished reading.
    return { error: "This one has already gone ahead. Reload the page." };
  }

  const state = (run.state ?? {}) as { offered?: Offer[] };
  const chosen = asChosen(names, state.offered ?? []);

  const wrong = wrongWith(chosen);
  if (wrong) return { error: wrong };

  /**
   * Their picks are theirs from now on.
   *
   * Written to `competitors` as well as to the run, because a set the owner
   * chose is the set every later run starts from: `prepare` loads it and the
   * run skips discovery entirely. Choosing once is meant to last.
   *
   * `source: "owner"` is what marks it as theirs rather than ours, and it is
   * what makes these survive a week when our own discovery would drop them.
   */
  const { error: keeping } = await supabase.from("competitors").upsert(
    chosen.map((name) => ({
      workspace_id: run.workspace_id,
      name,
      url: (state.offered ?? []).find((o) => o.name === name)?.url ?? null,
      why: "You chose this one",
      source: "owner",
      found_at: new Date().toISOString(),
    })),
    { onConflict: "workspace_id,name" },
  );

  if (keeping) {
    // Not fatal: the run can go ahead on this week's choice even if we failed
    // to remember it for next week. Recorded so the second failure is not the
    // first anybody hears of it.
    console.error(`[picker] could not remember the set for ${run.workspace_id}: ${keeping.message}`);
  }

  const { error: saving } = await supabase
    .from("runs")
    .update({ state: { ...(run.state ?? {}), chosen } })
    .eq("id", runId)
    .eq("stage", "picking");   // still waiting when we write, not just when we read

  if (saving) {
    console.error(`[picker] could not save the choice on ${runId}: ${saving.message}`);
    return { error: "We could not save that. Try again in a moment." };
  }

  revalidatePath("/workspace");
  return { error: null };
}
