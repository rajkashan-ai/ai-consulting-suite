"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send";
import { postsAsEmail, type Sendable } from "@/tools/content-social-planner/email";

/**
 * Email the posts they have made to themselves.
 *
 * WHY THERE IS USUALLY NOTHING TO CAPTURE
 * They signed in with an email address, so we already hold one. Asking for it
 * again would be asking a question we know the answer to, which is the fastest
 * way to make somebody distrust the rest of the form. `to` is only for the case
 * where the posts should go somewhere other than the account: a shared salon
 * inbox rather than the owner's own.
 *
 * The address is never written down. It comes off their session, is handed to
 * the sender, and goes out of scope: CLAUDE.md 1.4c rule 3, never record an
 * email.
 */
export async function sendPosts(
  workspaceId: string,
  to: string | null,
): Promise<{ error: string | null; sentTo: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in and try again.", sentTo: null };

  /**
   * Theirs, or the one they typed. Checked rather than trusted: this address
   * is the one thing on this screen that decides where their work is sent.
   */
  const typed = to?.trim() ?? "";
  const address = typed || user.email || "";
  if (!address) return { error: "We do not have an address for you.", sentTo: null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { error: "That does not look like an email address.", sentTo: null };
  }

  /* Read as the caller, so row level security decides. A workspace belonging
     to somebody else comes back as nothing, which is the right answer. */
  const { data: w } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!w) return { error: "That business is not there any more.", sentTo: null };

  const { data: made, error: reading } = await supabase
    .from("content_made")
    .select("words, shot, why, service, from_photo, source_on, photo_on, made_at")
    .eq("workspace_id", workspaceId)
    .order("made_at", { ascending: false });

  if (reading) {
    console.error(`[send] could not read the posts for ${workspaceId}: ${reading.message}`);
    return { error: "We could not reach your posts. Try again in a moment.", sentTo: null };
  }

  const built = postsAsEmail((made ?? []) as Sendable[], w.name);
  if ("error" in built) return { error: built.error, sentTo: null };

  const { error: sending } = await sendEmail(address, built.subject, built.text);
  if (sending) return { error: sending, sentTo: null };

  return { error: null, sentTo: address };
}
