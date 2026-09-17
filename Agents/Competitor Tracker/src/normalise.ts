/**
 * Comparing business names.
 *
 * "The Fade Inn", "the fade inn ltd" and "The Fade Inn Ltd." are one business.
 * Without this the customer adds a competitor that is already on the list, we
 * accept it, and they are then asked which of five to replace by something that
 * is already one of the five.
 */

const SUFFIXES = /\b(ltd|limited|llp|plc|inc|llc|co|company|the)\b/g;

/**
 * Keep letters and digits in ANY script, drop everything else.
 *
 * This was `[^a-z0-9\s]`, which deleted every character outside the English
 * alphabet. A shop trading as محل الحلاقة, 理髮店 or Перукарня normalised to the
 * empty string, and an empty string is inside every other string, so the step
 * that removes the customer from their own competitor list removed everybody.
 * The owner was then told we could find no competitors in their town, which is
 * false and impossible to act on.
 *
 * \p{L} and \p{N} keep letters and numbers in every script. Punctuation,
 * emoji and the right-to-left format characters are still dropped, because
 * those are not part of a name.
 */
function lettersAndDigits(raw: string): string {
  return raw
    .normalize('NFKD')                 // é and e-with-accent compare equal
    .replace(/[̀-ͯ]/g, '')   // drop the accents themselves
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normaliseName(raw: string): string {
  const base = lettersAndDigits(raw);

  /**
   * Stripping the suffixes must never take the whole name.
   *
   * "The Company" and "Co Ltd" are made entirely of the words this list
   * removes, so they normalised to nothing and hit exactly the same fault as a
   * name in another alphabet. They are ordinary English names. If taking the
   * suffixes out leaves nothing, the suffixes were the name, so keep it.
   */
  const stripped = base.replace(SUFFIXES, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > 0 ? stripped : base;
}

/**
 * The words of a name, for callers that need to match on whole words rather
 * than on any run of characters. See `notYou` in the app's sift.ts.
 */
export function nameWords(raw: string): string[] {
  const n = normaliseName(raw);
  return n.length ? n.split(' ') : [];
}

export function sameBusiness(a: string, b: string): boolean {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  return na.length > 0 && na === nb;
}

export const MAX_NAME_LENGTH = 120;

export type NameProblem = 'empty' | 'too-long';

/**
 * A name the customer typed. We store it as inert text whatever it contains:
 * markup is never executed, and it is never treated as an instruction. The only
 * two rejections are nothing at all, and something too long to be a name.
 */
/**
 * The characters that reorder a line rather than appear in it.
 *
 * U+202E and its family flip everything printed after them, and the isolates
 * do the same to a bounded run. They are invisible: a name carrying one looks
 * ordinary in a database and turns the rest of the row backwards on the page,
 * or disguises one string as another.
 *
 * `normaliseName` already dropped them, but only for comparing names. The name
 * we store and print kept them, which is the half that reaches a screen.
 *
 * Only the reordering controls are removed. Arabic, Hebrew and Persian names
 * are right to left by their own letters and need none of these to display
 * correctly, so nothing legitimate is lost.
 */
const REORDERING = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C]/g;

/** A name as it will be stored and shown. */
export function displayName(raw: string): string {
  return raw.replace(REORDERING, '').trim();
}

export function checkName(raw: string): { ok: true; name: string } | { ok: false; problem: NameProblem } {
  const name = displayName(raw);
  if (name.length === 0) return { ok: false, problem: 'empty' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, problem: 'too-long' };
  return { ok: true, name };
}
