/**
 * Page numbers instead of retyped urls.
 *
 * Same reasoning as the Competitor Tracker's, arrived at there first and worth
 * restating because this tool cannot import it (a tool reaching into another
 * tool is what `test/contract.test.ts` forbids, and the whole point of the
 * contract): a model asked to repeat a url will eventually repair one, and a
 * repaired url is an invented source. This tool writes the words a business
 * posts under its own name, so an invented source becomes their lie, not ours
 * (`Agents/Content & Social Planner/CLAUDE.md` 4).
 *
 * So the pages are numbered once, the model gives back a number, and we expand
 * it. A number it invents expands to nothing, which fails an honest check,
 * rather than to a plausible url nobody clicks.
 *
 * What differs from the Tracker: every page here belongs to the customer. There
 * is no `about`, because there is nobody else's page to confuse it with. This
 * tool never researches a competitor (CLAUDE.md 6.9).
 */

export type Page = {
  url: string;
  fetchedOn: string;
  /** What the page is, in the owner's words. "your price list". Never shown. */
  what: string;
};

export type Cited = { url: string; fetchedOn: string };

/**
 * Number the pages the model is about to be shown.
 *
 * Deduplicated by url: the same page arrives twice whenever a site links its
 * price list from two places, and two numbers for one page is two ways to cite
 * one fact. Order is the order given, so the numbers match the prompt.
 */
export function numberPages(pages: Page[]): Page[] {
  const seen = new Set<string>();
  const out: Page[] = [];
  for (const p of pages) {
    if (!p?.url || seen.has(p.url)) continue;
    seen.add(p.url);
    out.push({ url: p.url, fetchedOn: p.fetchedOn, what: p.what ?? "" });
  }
  return out;
}

/**
 * Turn a page number back into a url and a date.
 *
 * One based, because a person reads these too and "page 0" reads as a mistake.
 * Anything we did not hand out returns null, which is a claim with no source,
 * which the checking stage drops. That is the point: a made up number cannot
 * become a made up url.
 *
 * Not `Number(from)`, which coerces. `Number(true)` is 1, and so is `[1]` and
 * anything carrying a valueOf. This is the one function whose entire job is
 * refusing what it did not hand out, so it must not be the one that quietly
 * turns true into page one.
 */
export function expand(list: Page[], from: unknown): Cited | null {
  const n =
    typeof from === "number"
      ? from
      : typeof from === "string" && /^\s*\d+\s*$/.test(from)
        ? Number(from.trim())
        : NaN;

  if (!Number.isInteger(n) || n < 1 || n > list.length) return null;
  const page = list[n - 1];
  return { url: page.url, fetchedOn: page.fetchedOn };
}

/**
 * Walk what the model returned and turn every `from` into a `source`.
 *
 * Walked rather than expanded at each known place: the same citation shape sits
 * on a post, on a recommendation reason and on the voice note, at three depths.
 * Three separate expansions is three places for the next shape to be forgotten,
 * and a forgotten one is a silently unsourced claim.
 */
export function cite<T>(value: T, list: Page[]): T {
  if (Array.isArray(value)) return value.map((v) => cite(v, list)) as unknown as T;

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if ("from" in record) {
      const { from, ...rest } = record;
      const walked = Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, cite(v, list)]),
      );
      return { ...walked, source: expand(list, from) } as unknown as T;
    }

    return Object.fromEntries(
      Object.entries(record).map(([k, v]) => [k, cite(v, list)]),
    ) as unknown as T;
  }

  return value;
}

/** The numbered list, as it is shown above the pages in the prompt. */
export function citeRules(list: Page[]): string {
  return (
    `THE PAGES, NUMBERED. Cite by number, never by url.\n` +
    list.map((p, i) => `  [${i + 1}] ${p.url}  (read ${p.fetchedOn})`).join("\n") +
    `\n\nEvery fact you take off these pages carries "from": the number of the ` +
    `page it came from. Do not write urls or dates anywhere: they are already ` +
    `recorded against these numbers. A fact you cannot give a number for does ` +
    `not go in the post.`
  );
}
