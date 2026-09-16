"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CADENCES, CHANNEL, CRITIQUES } from "../../../../Agents/Content & Social Planner/src/types";
import { FIRST_STAGE, lastPlan } from "@/tools/content-social-planner/index";

/**
 * What the owner can do to a plan.
 *
 * Every control on the screen ends up in one of these. A control with nothing
 * behind it is the "Approve this week" button all over again: the most
 * consequential-sounding word on the screen attached to the least consequential
 * action, and it took Raj asking what it did to find out it did nothing.
 *
 * So each of these writes something, and anything that cannot write yet is not
 * offered as a button at all.
 */

/**
 * Gone out, with the link.
 *
 * No connected account needed, which is the whole point: the link gives us the
 * caption as published, and the difference between what we wrote and what they
 * posted is the most useful thing this tool can learn. CLAUDE.md 6a.
 */
export async function markPosted(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const postDate = String(form.get("postDate") ?? "");
  const channel = String(form.get("channel") ?? "");
  const url = String(form.get("url") ?? "").trim();

  /* A link that is not a link is a typo, not a post. Stored empty rather than
     stored wrong: we would rather know they posted and not where. */
  const ok = /^https?:\/\/\S+\.\S+/.test(url);
  if (!workspaceId || !postDate || !channel) return;

  const supabase = await createClient();
  await supabase.from("content_post_state").upsert(
    {
      workspace_id: workspaceId,
      post_date: postDate,
      channel,
      posted_at: new Date().toISOString(),
      posted_url: ok ? url : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,post_date,channel" },
  );
  revalidatePath("/workspace/content-social-planner");
}

/**
 * A correction to how we write for them.
 *
 * Named options, never a free text box, for the reason in UI/CLAUDE.md 6a: a
 * count is actionable and a mood is not. It is a toggle, because pressing it
 * again is how they take a correction back, and a correction they cannot undo
 * is one they stop making.
 *
 * It goes on the business, not in this plan, so it still holds in January and
 * the other five tools read it too.
 */
export async function toggleCritique(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const critique = String(form.get("critique") ?? "");
  /* CRITIQUES is a map of kind to label, so the labels are its values. */
  if (!workspaceId || !Object.values(CRITIQUES).includes(critique)) return;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("content_voice_note")
    .select("corrections")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const had = (row?.corrections ?? []) as string[];
  const now = had.includes(critique) ? had.filter((c) => c !== critique) : [...had, critique];

  await supabase.from("content_voice_note").upsert(
    { workspace_id: workspaceId, corrections: now, updated_at: new Date().toISOString() },
    { onConflict: "workspace_id" },
  );
  revalidatePath("/workspace/content-social-planner");
}

/**
 * Write the month again at a different rate.
 *
 * Their choice always wins (CLAUDE.md 2b), so this does not argue: it clears
 * the plan and starts a run, which is the only honest way to change a cadence,
 * because the mix, the angles and the dates are all derived from it and a plan
 * with the old shape and a new label would be a lie on the screen.
 */
export async function changeCadence(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? "");
  /* The cadence itself, not an approximate number of hours turned back into
     one: the conversion reads how many channels they have, so with one channel
     the "a couple of times a week" button rebuilt the month as once a week. */
  const cadence = String(form.get("cadence") ?? "");
  if (!workspaceId || !CADENCES.includes(cadence as never)) return;

  const supabase = await createClient();

  /**
   * The old plan is kept, not deleted.
   *
   * Deleting it was how this started a fresh run, and it threw away the only
   * record of what we have already suggested this business, which is what stops
   * the next month repeating the last one. The two buttons most likely to be
   * pressed destroyed the feature that exists to make pressing them worthwhile.
   *
   * The page reads the newest document, so a new one supersedes the old without
   * anything being removed. Only the runs go, because a finished run is what
   * makes the page show a plan rather than start one.
   */
  const { data: before } = await supabase
    .from("documents")
    .select("body")
    .eq("workspace_id", workspaceId)
    .eq("tool", "content-social-planner")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("runs").delete().eq("workspace_id", workspaceId).eq("tool", "content-social-planner");
  await supabase.from("runs").insert({
    workspace_id: workspaceId,
    tool: "content-social-planner",
    stage: FIRST_STAGE,
    state: { chose: cadence, before: lastPlan(before?.body) },
  });

  revalidatePath("/workspace/content-social-planner");
}

/**
 * Where they post, in their own words rather than ours.
 *
 * CLAUDE.md 2 has always said channels are detected and then shown for
 * confirmation, and nothing confirmed anything: the tool read the words
 * "instagram" and "facebook" out of their own page copy and took that as the
 * answer. That worked for a barber whose home page happens to name both, and
 * gave nothing at all to a business whose copy never names a platform.
 *
 * Stored on the workspace, because where they post is a fact about the
 * business and the other five tools have the same right to it.
 *
 * An empty answer is recorded as empty rather than left null. "We asked and
 * they post nowhere" and "nobody asked" are different, and only one of them
 * should ever fall back to reading their page text.
 */
export async function saveChannels(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? "");
  if (!workspaceId) return;

  const chosen = form
    .getAll("channel")
    .map(String)
    .filter((c) => c in CHANNEL);

  const supabase = await createClient();
  await supabase.from("workspaces").update({ channels: chosen }).eq("id", workspaceId);

  /* The month is built from the channels, so changing them makes the stored
     plan wrong rather than out of date. The runs go so the page starts a new
     one; the document stays, because it is the record of what we have already
     suggested and the next run reads it. */
  await supabase.from("runs").delete().eq("workspace_id", workspaceId).eq("tool", "content-social-planner");

  revalidatePath("/workspace/content-social-planner");
}
