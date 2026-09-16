/**
 * Is that price actually printed on the page it cites?
 *
 * Everything else we check is about the source: that it exists, that we read
 * it, that it belongs to the business the fact is about. None of that says the
 * number is on it. A model does not read a figure off a page the way a person
 * does; it regenerates it from twenty thousand characters, and the right price
 * against the wrong service, or a "from £15" written as "£15", is the ordinary
 * way that goes wrong.
 *
 * ON THE EVIDENCE, 2026-09-16: ten of ten money figures on the one real run we
 * have are printed on the pages they cite. Nothing has been invented yet. This
 * exists to keep it that way, not to fix a fault we found.
 *
 * MONEY ONLY, AND DELIBERATELY. A price is the figure an owner acts on and the
 * one that has to be exact. Counts are different: "3 of 9 mention waiting" is
 * derived by counting, so the 3 is correctly nowhere on the page, and a rule
 * that demanded every number be printed would delete the most useful lines we
 * write.
 *
 * A NOTE ON THE PAGE TEXT. It carries no pound sign. Our extraction decodes
 * &pound; but these pages print prices as bare numbers, "15.00" and "20.00",
 * with the currency in the markup. Checking for "£15" finds nothing on a
 * perfectly good page, which is a false alarm on every price in the product. I
 * made exactly that mistake reading this back, and reported an invented price
 * that was not invented. Hence `written`, below.
 */

/** The ways one amount can be printed: 18, 18.0, 18.00. */
export function written(amount: string): string[] {
  const n = Number(amount);
  if (!Number.isFinite(n)) return [];
  return [...new Set([String(n), n.toFixed(1), n.toFixed(2)])];
}

/**
 * Is this amount printed on this page?
 *
 * Bounded either side so 18 does not match inside 180 or 2018, which would make
 * the check pass for almost anything and be worse than no check at all.
 */
export function onPage(amount: string, text: string): boolean {
  if (!text) return false;

  /**
   * Not inside a longer number, and not inside a time.
   *
   * Bounding on digits alone let "16" match "Monday 8:45 - 16:00", so a £16
   * price was verified against an opening time. The customer's own page in the
   * fixture is opening hours and a phone number and nothing else, which is
   * exactly the page where that false match would be believed.
   */
  return written(amount).some((form) =>
    new RegExp(`(?<![\\d.:])${form.replace(".", "\\.")}(?![\\d:])`).test(text),
  );
}

/** Every money figure in a piece of text. */
export function moneyIn(value: string): string[] {
  return [...String(value ?? "").matchAll(/£\s?(\d+(?:\.\d{1,2})?)/g)].map((m) => m[1]);
}

export type Checked =
  | { kind: "ok" }
  /** A figure we could look for and could not find. */
  | { kind: "not there"; amount: string }
  /** We have no text for that page, so we cannot say either way. */
  | { kind: "no page" };

/**
 * Check one cell's value against the page it cites.
 *
 * When there is no text for the page, the answer is "we cannot say", never
 * "it is wrong". Treating an unknown as a failure would blank good data on a
 * plumbing fault of ours, and the page an owner reads would get worse because
 * our own bookkeeping slipped.
 */
export function check(value: string | null, pageText: string | null | undefined): Checked {
  if (value == null) return { kind: "ok" };

  const amounts = moneyIn(value);
  if (!amounts.length) return { kind: "ok" };

  if (pageText == null) return { kind: "no page" };

  for (const amount of amounts) {
    if (!onPage(amount, pageText)) return { kind: "not there", amount };
  }
  return { kind: "ok" };
}
