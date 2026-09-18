/**
 * The posts they made, as something they can read on a phone.
 *
 * WHY THIS IS NOT READ OFF THE SCREEN
 * The thing this replaces built its file by walking the DOM: it queried
 * `#this-week .card` and pulled text out of the rendered page. That works until
 * a class is renamed, and then it silently produces an empty file rather than
 * failing. It also meant the file could only ever contain what happened to be
 * on screen. This takes the posts themselves, so it can be tested without a
 * browser and cannot drift from what was actually written.
 *
 * Nothing here sends anything. It is the words and the subject line, so the
 * part that can be checked is separate from the part that needs a network.
 */

/** What a made post carries, as much of it as an email needs. */
export type Sendable = {
  words: string;
  shot: string | null;
  why: string | null;
  service: string | null;
  from_photo: boolean;
  source_on: string | null;
  photo_on: string | null;
  made_at: string;
};

/** The most we put in one email. Beyond this it stops being readable on a phone. */
export const MOST_POSTS = 20;

const madeOn = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};

/**
 * Where the words came from, said once under each post.
 *
 * The same two halves the screen shows. An email that dropped the sourcing
 * would be the one copy of these posts with no way to check them, and it is the
 * copy they will actually be looking at when they paste.
 */
const credit = (p: Sendable): string => {
  const page = `your own page${p.source_on ? `, read ${p.source_on}` : ""}`;
  return p.from_photo ? `From your photo${p.photo_on ? `, added ${p.photo_on}` : ""}, and ${page}` : `From ${page}`;
};

/**
 * The email, or a reason there is nothing to send.
 *
 * Newest first, the same order as the screen, so what they read in the email
 * is in the order they just saw.
 */
export function postsAsEmail(
  posts: readonly Sendable[],
  businessName: string,
): { subject: string; text: string } | { error: string } {
  const real = posts.filter((p) => p?.words?.trim());
  if (!real.length) {
    return { error: "There is nothing to send yet. Make a post first." };
  }

  const sending = real.slice(0, MOST_POSTS);
  const n = sending.length;
  const lines: string[] = [
    `${n} post${n === 1 ? "" : "s"} for ${businessName}, ready to paste.`,
    "",
    "Post them when it suits. Nothing here is late.",
    "",
  ];

  for (const p of sending) {
    lines.push("-----------------------------------------");
    const when = madeOn(p.made_at);
    lines.push([when, p.service].filter(Boolean).join("  ·  ") || "A post you asked for", "");
    lines.push(p.words.trim(), "");
    if (p.shot?.trim()) lines.push(`PHOTOGRAPH: ${p.shot.trim()}`, "");
    if (p.why?.trim()) lines.push(`WHY: ${p.why.trim()}`, "");
    lines.push(credit(p), "");
  }

  if (real.length > sending.length) {
    lines.push("-----------------------------------------");
    lines.push(`${real.length - sending.length} older ones are still in the app.`, "");
  }

  return {
    subject: `${n} post${n === 1 ? "" : "s"} for ${businessName}`,
    text: lines.join("\n"),
  };
}
