"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CRITIQUES } from "../../../../Agents/Content & Social Planner/src/types";
import { FIRST_STAGE } from "@/tools/content-social-planner/index";

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
 * Their words instead of ours, kept for ever.
 *
 * CLAUDE.md 5: a post the owner has edited is never overwritten. That is the
 * one rule in the tool with no exception, which is why their words go in their
 * own row rather than over the top of the document we produced.
 */
export async function saveEdit(form: FormData) {
  const workspaceId = String(form.get("workspaceId") ?? "");
  const postDate = String(form.get("postDate") ?? "");
  const channel = String(form.get("channel") ?? "");
  const words = String(form.get("words") ?? "").trim();
  if (!workspaceId || !postDate || !channel || !words) return;

  const supabase = await createClient();
  await supabase.from("content_post_state").upsert(
    { workspace_id: workspaceId, post_date: postDate, channel, edited_words: words, updated_at: new Date().toISOString() },
    { onConflict: "workspace_id,post_date,channel" },
  );
  revalidatePath("/workspace/content-social-planner");
}

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
  const hoursAWeek = Number(form.get("hoursAWeek") ?? 0);
  if (!workspaceId || !Number.isFinite(hoursAWeek)) return;

  const supabase = await createClient();
  await supabase.from("documents").delete().eq("workspace_id", workspaceId).eq("tool", "content-social-planner");
  await supabase.from("runs").delete().eq("workspace_id", workspaceId).eq("tool", "content-social-planner");
  await supabase
    .from("runs")
    .insert({ workspace_id: workspaceId, tool: "content-social-planner", stage: FIRST_STAGE, state: { hoursAWeek } });

  revalidatePath("/workspace/content-social-planner");
}
