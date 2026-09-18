"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CHANNEL } from "../../../../Agents/Content & Social Planner/src/types";

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
