"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CHANNEL } from "../../../Agents/Content & Social Planner/src/types";
import { changesFrom } from "@/tools/profile";

/**
 * What they can change about their business, whenever they like.
 *
 * WHY EVERY FIELD IS OPTIONAL
 * Signing up needs a web address and nothing else, which is the whole point:
 * somebody should be able to see what the tools do before deciding whether we
 * are worth typing an address into. Everything here makes the tools work
 * better and none of it is a gate.
 *
 * So a blank field means "I have not said", not "delete what you knew". The
 * one exception is a field they deliberately empty, which is them correcting
 * us, and that has to be possible or the correction is not a correction. The
 * two are told apart by the field being present in the form at all.
 */
export async function saveProfile(form: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const workspaceId = String(form.get("workspaceId") ?? "");
  if (!workspaceId) return;

  const change = changesFrom(form, Object.keys(CHANNEL));
  if ("error" in change) {
    /* Nothing is written. The screen keeps what they typed, so the correction
       is one keystroke away rather than typed again. */
    console.error(`[profile] refused a change for ${workspaceId}: ${change.error}`);
    return;
  }

  if (!Object.keys(change).length) return;

  /* As the caller, so row level security decides whose business this is. */
  const { error } = await supabase.from("workspaces").update(change).eq("id", workspaceId);

  if (error) {
    console.error(`[profile] could not save ${workspaceId}: ${error.message}`);
    return;
  }

  revalidatePath("/workspace");
}
