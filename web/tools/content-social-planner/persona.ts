/**
 * Brand Persona: how this business sounds, and the choice of sounding
 * otherwise.
 *
 * WHY THIS REPLACED "HOW YOU SOUND"
 * That was two sentences of prose read off their website, shown near the
 * bottom, and used quietly by the writer. Three problems with it, and Raj named
 * all three on 2026-09-17:
 *
 *  - A website is often written by whoever built the site in 2019. Their own
 *    posts are how they actually talk, and nobody was ever asked for one.
 *  - Two sentences cannot be checked. "Warm and professional" is agreeable and
 *    unfalsifiable, and an owner cannot correct it because there is nothing in
 *    it to correct.
 *  - It was a finding, not a decision. An owner who does not like how they
 *    sound had no way to choose differently.
 *
 * So: read from what they give us, broken into parts they can disagree with,
 * and a choice of five ways to sound instead, previewed on their own words
 * before anything is locked in.
 *
 * Nothing here talks to a model or a database.
 */

/**
 * The five, and the original.
 *
 * Five because a menu long enough to browse is a menu nobody finishes, and
 * because these five cover the small businesses this product is for. Each says
 * what it sounds like rather than naming an adjective: "warm" is a word every
 * one of them would claim.
 *
 * `original` is not a sixth style. It is the way out, and it is listed first
 * for that reason: whatever they try, their own voice is one click away and is
 * what they started with.
 */
export const STYLES = [
  {
    id: "original",
    label: "Your own voice",
    vibe: "However you already sound, read from what you gave us.",
    sounds: "Unchanged. This is your writing, not ours.",
    suits: "Anyone happy with how they already come across.",
  },
  {
    id: "expert",
    label: "Expert and authoritative",
    vibe: "Knowledgeable, reassuring, precise.",
    sounds:
      "Facts, standards and plain competence, without being stuffy. Language that says you are in safe hands.",
    suits: "Specialists, high-end services, trades that pride themselves on precision, wellbeing.",
  },
  {
    id: "warm",
    label: "Warm and conversational",
    vibe: "Approachable, open, down to earth.",
    sounds:
      "Like a text from someone you know. Contractions, talks to you directly, no corporate words at all.",
    suits: "Local salons, independent shops, family-run and community businesses.",
  },
  {
    id: "direct",
    label: "Direct and no-nonsense",
    vibe: "Straightforward, efficient, practical.",
    sounds:
      "Short sentences, no filler, clear prices and clear next steps. Assumes you are as busy as they are.",
    suits: "Busy service providers, mobile businesses, emergency trades, anything functional.",
  },
  {
    id: "uplifting",
    label: "Inspiring and uplifting",
    vibe: "Motivating, positive, encouraging.",
    sounds:
      "Focused on the customer feeling capable and seen. Never cheesy, and never positivity for its own sake.",
    suits: "Coaches, trainers, creative studios, anything about personal progress.",
  },
  {
    id: "story",
    label: "Storyteller, behind the scenes",
    vibe: "Narrative, open, human.",
    sounds:
      "Shares the why and the how: the reality of running it, the problem solved, the thing built from scratch.",
    suits: "Makers, artisans, independent creators, founder-led businesses.",
  },
] as const;

export type StyleId = (typeof STYLES)[number]["id"];

export const isStyle = (x: unknown): x is StyleId =>
  typeof x === "string" && STYLES.some((s) => s.id === x);

export const styleById = (id: StyleId) => STYLES.find((s) => s.id === id)!;

/**
 * What a style asks of the writing, said to the writer rather than to the
 * owner.
 *
 * The owner reads `sounds`, which describes a feeling. A model given a feeling
 * writes a pastiche of it, so it gets instructions instead: sentence length,
 * contractions, what to reach for and what never to. Two audiences, two texts,
 * and the same failure as telling the guard the prices and not the writer.
 */
export const STYLE_RULES: Record<Exclude<StyleId, "original">, string> = {
  expert:
    "Precise and calm. Name the standard, the material or the method where it is in their pages. " +
    "No exclamation marks. No superlatives. Never talk down: the reader is capable, they are just not a specialist.",
  warm:
    "Write as if to one person you know. Contractions throughout. Say you and we. " +
    "No word a person would not say aloud in their own shop. Short paragraphs with a line between them.",
  direct:
    "Sentences under fifteen words. No preamble, no sign-off, no adjectives that could be cut. " +
    "Lead with the thing they need to know, put the action last, and stop.",
  uplifting:
    "Address what the reader wants to be able to do, not what the business wants to sell. " +
    "Encourage without promising. Never toxic positivity, never a platitude that would fit any business.",
  story:
    "Tell it in order: what happened, what was hard, what came of it. First person plural. " +
    "One specific detail a stranger could not have guessed. No moral at the end.",
};

/**
 * A voice read from what they gave us, in parts they can disagree with.
 *
 * Every field is short and concrete on purpose. The prose version was capped at
 * 260 characters after it came back at 420 as a paragraph of criticism, with
 * quotes about what the copy "allows itself". A field asking for five words
 * cannot become an assessment.
 */
export type Persona = {
  /** How they come across, in one line. */
  tone: string;
  /** Everyday words they actually use. Their words, quoted from their own text. */
  uses: string[];
  /** Words they never reach for, which is as much of a fingerprint as the ones they do. */
  avoids: string[];
  /** Sentence length, line breaks, whether they say you and we. */
  style: string;
  /** Which of the five they chose, or `original` for the voice we read. */
  chosen: StyleId;
};

/** The most samples worth pasting. Three is enough to see a pattern. */
export const SAMPLES_MAX = 3;
export const SAMPLE_MIN = 40;
export const SAMPLE_MAX = 1_200;

/**
 * Posts they pasted, made safe to read.
 *
 * Their own words, given freely, which is why there is no robots question here:
 * Instagram and Facebook both disallow us outright, so a handle cannot be read
 * however much anybody wants it to be. Pasting is not a workaround, it is the
 * owner handing us their own writing.
 */
export function asSamples(raw: unknown): string[] {
  const list = typeof raw === "string" ? raw.split(/\n\s*\n/) : Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const one of list) {
    if (typeof one !== "string") continue;
    const text = one.trim();
    if (text.length < SAMPLE_MIN || text.length > SAMPLE_MAX) continue;
    if (out.includes(text)) continue;
    out.push(text);
    if (out.length >= SAMPLES_MAX) break;
  }
  return out;
}

/**
 * A page whose writing they admire, or why it cannot be used.
 *
 * A website or a blog. Not a social account: Instagram and Facebook disallow
 * us in robots.txt, and CLAUDE.md 1.5 says a block is the gate rather than an
 * obstacle. Refused here with a reason rather than fetched and failed, so the
 * owner is told why instead of watching it do nothing.
 */
const CANNOT_READ = ["instagram.com", "facebook.com", "tiktok.com", "x.com", "twitter.com"];

export function asInspiration(raw: unknown): { url: string } | { error: string } | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return { error: "That does not look like a web address." };

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let host = "";
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return { error: "That does not look like a web address." };
    host = url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    // Expected: `new URL` throws on anything that is not one, which is most of
    // what somebody types into a box. The same sentence either way, because
    // "malformed url" is our word for it and theirs is "that is not a website".
    return { error: "That does not look like a web address." };
  }

  const blocked = CANNOT_READ.find((h) => host === h || host.endsWith(`.${h}`));
  if (blocked) {
    return {
      error:
        `${blocked.replace(/\.com$/, "")} asks us not to read it, and we do not go around that. ` +
        `A website or a blog works.`,
    };
  }

  return { url: withScheme.replace(/\/$/, "") };
}
