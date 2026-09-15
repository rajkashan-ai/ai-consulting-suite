/**
 * Taking other people's personal data out of anything we are about to store.
 *
 * WHY THIS EXISTS
 * Most of what this product holds is business data, and business data is not
 * personal data. The exception is reviews. A review is written by a real person
 * who has never heard of us, did not agree to anything, and often names a
 * member of staff. CLAUDE.md 1.5 rule 6 already says reviews give themes and
 * never named individuals, and under UK GDPR "it was public" is not a lawful
 * basis for anything. This turns that rule from a sentence in a document into
 * something the code enforces.
 *
 * TWO LAYERS, BECAUSE ONE IS NOT ENOUGH
 * The model is told not to return names. This catches it when it does anyway,
 * and it catches the things a model is not good at spotting: an email address
 * inside a quoted sentence, a mobile number, a postcode that locates a house.
 * Neither layer is reliable on its own. Together they are the difference
 * between a rule we mean and a rule we keep.
 *
 * WHAT IT CANNOT DO
 * It cannot reliably find a first name in running text, because a first name
 * looks like an ordinary word. That is why the model is told to write
 * "[a barber]" in the first place, and why storeReview below drops any quote
 * that still carries a capitalised name we were given.
 */

const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

// UK mobile and landline, spaced or not, with or without +44.
// Non-capturing throughout. A capturing group here once left the leading "0"
// behind, so "07700 900123" redacted to "0[phone]" and a test caught it.
const PHONE = /(?:\+?44[\s.-]?|\b0)(?:\d[\s.-]?){9,10}\d\b/g;

// A full UK postcode locates a household, so it is personal data on its own.
// The outward code alone ("SY1") is a district and is left in place.
const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;

// @handle. A social account is a person unless it is the business's own, which
// is why keep() exists below. Lookbehind rather than a captured leading space,
// so no pattern in this file has a capture group to put back by hand.
const HANDLE = /(?<=^|[\s(])@[A-Za-z0-9._]{2,30}\b/g;

export type Redaction = {
  text: string;
  /** What was taken out, by kind, so a log can say so without repeating it. */
  removed: string[];
};

export function redact(
  input: string,
  options: { keep?: string[]; names?: string[] } = {},
): Redaction {
  const removed: string[] = [];
  const keep = new Set((options.keep ?? []).map((k) => k.toLowerCase()));

  let text = input;

  const strip = (re: RegExp, label: string, replacement: string) => {
    re.lastIndex = 0;
    text = text.replace(re, (match) => {
      const bare = match.trim().toLowerCase();
      if (keep.has(bare) || keep.has(bare.replace(/^@/, ""))) return match;
      if (!removed.includes(label)) removed.push(label);
      return replacement;
    });
  };

  strip(EMAIL, "an email address", "[email]");
  strip(PHONE, "a phone number", "[phone]");
  strip(POSTCODE, "a postcode", "[postcode]");
  strip(HANDLE, "a social handle", "[account]");

  // Names we were actually given, for example staff listed on a competitor's
  // own site. Whole word only, so "Mark" does not eat "marked".
  for (const name of options.names ?? []) {
    const clean = name.trim();
    if (clean.length < 3) continue;
    const re = new RegExp(`\\b${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (re.test(text)) {
      text = text.replace(re, "[a person]");
      if (!removed.includes("a name")) removed.push("a name");
    }
  }

  return { text, removed };
}

/**
 * The gate a review quote has to pass before it can be stored.
 *
 * Returns null rather than a cleaned-up string when it is not confident. A
 * review we drop costs us one quote. A review we keep with somebody's name in
 * it is us publishing a stranger's personal data to our customer, which is the
 * kind of thing that ends a small company.
 */
export function safeQuote(
  quote: string,
  options: { names?: string[]; keep?: string[] } = {},
): string | null {
  const { text, removed } = redact(quote, options);

  // Anything personal in it at all and the whole quote goes. Not cleaned and
  // kept: if a review carried somebody's phone number, we have no idea what
  // else in that sentence identifies them, and one quote is not worth finding
  // out. Keeping the business's own handle is what `keep` is for.
  if (removed.length) return null;

  // Rule 5: we summarise, we do not reproduce. A long quote stops being a
  // citation and becomes a copy of somebody's writing.
  if (text.trim().split(/\s+/).length > 25) return null;

  return text.trim() || null;
}

/**
 * Last check before anything a tool produced is written to the database.
 * Throws rather than cleaning, because at this point something upstream is
 * wrong and quietly fixing it would hide the bug that put it there.
 */
export function assertNoContactDetails(value: unknown, where: string): void {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  for (const [re, what] of [
    [EMAIL, "an email address"],
    [PHONE, "a phone number"],
  ] as const) {
    re.lastIndex = 0;
    if (re.test(text)) {
      re.lastIndex = 0;
      throw new Error(
        `Refusing to store ${what} found in ${where}. ` +
          `Third party contact details are not ours to keep. See lib/privacy/redact.ts.`,
      );
    }
  }
}
