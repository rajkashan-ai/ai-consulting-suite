/**
 * Page numbers instead of retyped urls.
 *
 * The model was asked to write out a full url and a date into every grid cell,
 * every claim and every piece of evidence. A finished card has around 230 of
 * them, Booksy urls run to eighty characters, and that worked out at roughly
 * ten thousand output tokens per run: about forty per cent of the slowest
 * stage, spent retyping addresses we already had in memory.
 *
 * Output tokens are the runtime. The measured rate is about a hundred a
 * second, so those ten thousand tokens were a minute and a half of every run.
 *
 * It was also the riskiest thing we asked for. This codebase already says, in
 * the search step, that a model asked to repeat twenty urls will eventually
 * repair one, and a repaired url is an invented source on a page whose whole
 * argument is that it invents nothing. The same risk applied here and we were
 * asking for it two hundred times a card.
 *
 * So the pages are numbered once, the model gives back a number, and we expand
 * it from the list. A number it makes up expands to nothing, which fails an
 * honest check, rather than to a plausible url nobody notices.
 */

export type Page = { url: string; fetchedOn: string };
export type Cited = { url: string; fetchedOn: string };

/**
 * Number the pages the model is about to be shown.
 *
 * Deduplicated by url, because the same page can arrive as both a listing and
 * a competitor's page, and two numbers for one page is two ways to cite the
 * same fact. Order is the order given, so the numbers match the prompt.
 */
export function numberPages(pages: Page[]): Page[] {
  const seen = new Set<string>();
  const out: Page[] = [];
  for (const p of pages) {
    if (!p?.url || seen.has(p.url)) continue;
    seen.add(p.url);
    out.push({ url: p.url, fetchedOn: p.fetchedOn });
  }
  return out;
}

/**
 * Turn a page number back into a url and a date.
 *
 * Numbers are 1 based because they are read by a person as well as a model,
 * and "page 0" reads as a mistake. Anything that is not a number we handed out
 * returns null: a claim with no source, which the guards already refuse. That
 * is the whole point. A made up number cannot become a made up url.
 */
export function expand(list: Page[], from: unknown): Cited | null {
  const n = typeof from === "number" ? from : Number(from);
  if (!Number.isInteger(n) || n < 1 || n > list.length) return null;
  const page = list[n - 1];
  return { url: page.url, fetchedOn: page.fetchedOn };
}

/**
 * Walk what the model returned and turn every `from` into a `source`.
 *
 * Done by walking rather than at each known place, because the same citation
 * shape appears in grid cells, in per business claims and in action evidence,
 * at three different depths. Three separate expansions is three places for the
 * next shape to be forgotten, and a forgotten one is a silently unsourced
 * claim, which is the one failure this product cannot have.
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
    `\n\nEvery claim carries "from": the number of the page it came from. Do not ` +
    `write urls or dates anywhere: they are already recorded against these ` +
    `numbers. A claim you cannot give a number for does not go in.`
  );
}
