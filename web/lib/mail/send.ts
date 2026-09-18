import "server-only";
import { AgentMailClient } from "agentmail";

/**
 * Sending one email, and nothing else.
 *
 * Kept this thin on purpose. Everything that can be checked without a network
 * is in `tools/content-social-planner/email.ts`; what is left here is the call
 * itself, which cannot be tested without spending and without an account.
 *
 * WHAT IT NEEDS
 * AGENTMAIL_API_KEY and AGENTMAIL_INBOX, the inbox the mail goes out from.
 * Without either it refuses and says so, rather than throwing somewhere the
 * owner would see as "something went wrong". A missing key is our problem and
 * they should be told that plainly rather than blamed for it.
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<{ error: string | null }> {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  const inbox = process.env.AGENTMAIL_INBOX;

  if (!apiKey || !inbox) {
    console.error("[mail] AGENTMAIL_API_KEY or AGENTMAIL_INBOX is not set, so nothing was sent");
    return { error: "We cannot send email yet. Nothing was sent, and this one is on us." };
  }

  try {
    await new AgentMailClient({ apiKey }).inboxes.messages.send(inbox, { to, subject, text });
    return { error: null };
  } catch (e) {
    /* Recorded, never swallowed (CLAUDE.md 1.4c). The address is theirs and
       does not go in the log: 1.4c rule 3 says never record an email. */
    console.error(`[mail] send failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return { error: "We could not send that just now. Try again in a moment." };
  }
}
