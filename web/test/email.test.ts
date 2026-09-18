/**
 * Emailing the posts, checked without a network and without an account.
 *
 * What this covers is everything except the call itself: the words, the
 * sourcing that goes with them, and the refusals. The send is four lines in
 * lib/mail/send.ts for exactly this reason.
 *
 * Built 2026-09-18, replacing "Send me this week", which said send and did not.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MOST_POSTS, postsAsEmail, type Sendable } from "../tools/content-social-planner/email.ts";

const aPost = (over: Partial<Sendable> = {}): Sendable => ({
  words: "People often ring and ask what a cut costs, so here it is plainly.",
  shot: "The styling chairs at the front, lights on.",
  why: "Price questions come in by phone all day.",
  service: null,
  from_photo: false,
  source_on: "2026-09-17",
  photo_on: null,
  made_at: "2026-09-18T10:00:00.000Z",
  ...over,
});

const body = (posts: Sendable[]): string => {
  const built = postsAsEmail(posts, "A Cut Above");
  assert.ok(!("error" in built), "it refused when there was something to send");
  return (built as { text: string }).text;
};

test("nothing made yet is a reason, not an empty email", () => {
  const got = postsAsEmail([], "A Cut Above");
  assert.ok("error" in got);
  assert.match((got as { error: string }).error, /make a post first/i);
});

test("a post with no words is not a post", () => {
  assert.ok("error" in postsAsEmail([aPost({ words: "   " })], "A Cut Above"));
});

test("the subject says how many and whose", () => {
  const one = postsAsEmail([aPost()], "A Cut Above") as { subject: string };
  assert.equal(one.subject, "1 post for A Cut Above");
  const two = postsAsEmail([aPost(), aPost()], "A Cut Above") as { subject: string };
  assert.match(two.subject, /^2 posts for A Cut Above$/);
});

test("the words they paste are in it, whole", () => {
  const words = "Bride in at 6am, done before we opened. Book online or call us.";
  assert.ok(body([aPost({ words })]).includes(words), "the post was cut short or reworded");
});

test("what to photograph and why travel with it", () => {
  const text = body([aPost()]);
  assert.match(text, /PHOTOGRAPH: The styling chairs/);
  assert.match(text, /WHY: Price questions/);
});

test("a post with no shot or reason still reads properly", () => {
  const text = body([aPost({ shot: null, why: "  " })]);
  assert.doesNotMatch(text, /PHOTOGRAPH:|WHY:/);
  assert.doesNotMatch(text, /null|undefined/);
});

test("the sourcing goes with the words, because this is the copy they paste from", () => {
  /**
   * The email is the version they will actually be looking at on their phone
   * when they post. Dropping the credit here would leave the one copy that
   * gets used with no way to check it.
   */
  assert.match(body([aPost()]), /From your own page, read 2026-09-17/);

  const photo = body([aPost({ from_photo: true, photo_on: "2026-09-18", service: "Balayage" })]);
  assert.match(photo, /From your photo, added 2026-09-18, and your own page, read 2026-09-17/);
  assert.match(photo, /Balayage/, "the service the photo showed is not named");
});

test("each post is separated, so they do not run together on a phone", () => {
  const text = body([aPost(), aPost(), aPost()]);
  assert.equal(text.match(/^-{20,}$/gm)?.length, 3, "the posts are not divided");
});

test("nothing here is presented as a deadline", () => {
  const text = body([aPost()]);
  assert.match(text, /nothing here is late/i);
  assert.doesNotMatch(text, /due|overdue|schedule[d]?\b|deadline/i);
});

test("a very long list is capped and says what is left", () => {
  const many = Array.from({ length: MOST_POSTS + 3 }, () => aPost());
  const text = body(many);
  assert.equal(text.match(/^-{20,}$/gm)?.length, MOST_POSTS + 1, "every post went in, cap included");
  assert.match(text, /3 older ones are still in the app/);
});

test("exactly the cap says nothing about older ones", () => {
  assert.doesNotMatch(body(Array.from({ length: MOST_POSTS }, () => aPost())), /older ones/);
});

/* ── the parts that touch a network, checked by reading them ────────────── */

const file = (...bits: string[]) => readFileSync(join(import.meta.dirname, "..", ...bits), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

test("a missing key is our fault, said as ours, and sends nothing", () => {
  const sender = file("lib", "mail", "send.ts");
  assert.match(code(sender), /AGENTMAIL_API_KEY/);
  assert.match(code(sender), /AGENTMAIL_INBOX/);
  assert.match(sender, /this one is on us/i, "a missing key reads as the owner's mistake");
});

test("the address is never written into a log", () => {
  /**
   * CLAUDE.md 1.4c rule 3: never record an email. The failure path is the one
   * that tempts you, because the address is the thing you want to know.
   */
  const sender = code(file("lib", "mail", "send.ts"));
  const action = code(file("app", "workspace", "[tool]", "send-actions.ts"));
  for (const [name, src] of [["send.ts", sender], ["send-actions.ts", action]] as const) {
    for (const logged of src.match(/console\.(error|log|warn)\([^)]*\)/g) ?? []) {
      assert.doesNotMatch(logged, /\bto\b|address|email|user\.email/, `${name} logs the address: ${logged}`);
    }
  }
});

test("we do not ask for an address we already hold", () => {
  const action = code(file("app", "workspace", "[tool]", "send-actions.ts"));
  assert.match(action, /user\.email/, "the signed-in address is not used");

  const screen = file("app", "workspace", "[tool]", "send-posts.tsx");
  assert.match(screen, /knownEmail/, "the screen does not know what we already have");
  assert.match(screen, /Send somewhere else/, "there is no way to send it to a shared inbox");
});

test("the button no longer promises something it does not do", () => {
  /* "Send me this week" downloaded a file. Twice now a control on this screen
     has said the most consequential word and done the least. */
  const screen = file("app", "workspace", "[tool]", "send-posts.tsx");
  assert.match(screen, /Email these to me/);
  assert.doesNotMatch(code(screen), /a\.download|createObjectURL|querySelectorAll/, "it still scrapes the page");
});

test("an address that is not one is refused before anything is sent", () => {
  const action = code(file("app", "workspace", "[tool]", "send-actions.ts"));
  const check = action.indexOf("does not look like an email");
  const send = action.indexOf("sendEmail(");
  assert.ok(check > 0 && check < send, "a bad address reaches the sender");
});

/* ── throwing one away ──────────────────────────────────────────────────── */

test("a post they throw away is deleted, not hidden", () => {
  /**
   * Nothing else points at a made post, so there is no reason to keep one they
   * told us to let go of. Hiding it would mean holding the words of somebody's
   * business after they asked us not to.
   */
  const action = code(file("app", "workspace", "[tool]", "send-actions.ts"));
  const fn = action.slice(action.indexOf("export async function deletePost"));
  assert.match(fn, /\.from\("content_made"\)\s*\.delete\(\)/, "it is not a delete");
  assert.doesNotMatch(fn, /deleted_at|hidden|archived|\.update\(/, "it hides the post instead");
});

test("whose post it is, is decided by row level security and not by us", () => {
  /**
   * The policy on content_made already answers this. Checking it here as well
   * would be two rules for one question, which is how they end up disagreeing.
   */
  const action = code(file("app", "workspace", "[tool]", "send-actions.ts"));
  assert.match(action, /createClient\(\)/);
  assert.doesNotMatch(action, /createAdminClient/, "it deletes past row level security");

  const sql = file("supabase", "content-planner-2026-09-17-made-posts.sql");
  assert.match(sql, /for all/, "the policy does not cover deleting");
  assert.match(sql, /owner_id = auth\.uid\(\)/);
});

test("the page redraws, or the post they deleted stays on screen", () => {
  const action = code(file("app", "workspace", "[tool]", "send-actions.ts"));
  const fn = action.slice(action.indexOf("export async function deletePost"));
  assert.match(fn, /revalidatePath/, "the list is not redrawn after a delete");
});

test("it asks once before throwing anything away", () => {
  /* One stray tap should not lose a post. Two presses, and the second says
     what it does rather than saying "confirm". */
  const screen = file("app", "workspace", "[tool]", "delete-post.tsx");
  const c = code(screen);
  assert.match(c, /if \(!asking\)/, "the first press deletes it");
  assert.match(screen, /Throw it away\?/, "the second press does not say what it does");
  assert.match(screen, /Keep it/, "there is no way to change your mind");
  assert.doesNotMatch(c, /window\.confirm|alert\(/, "it puts a browser box over the screen");
});
