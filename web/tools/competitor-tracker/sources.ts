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

export type Page = {
  url: string;
  fetchedOn: string;
  /**
   * The business this page was read for, or null when it covers the whole town.
   *
   * A listing page prints every barber in Shrewsbury, so it can honestly source
   * a fact about any of them. A competitor's own booking page cannot source a
   * fact about somebody else, and that is the whole reason this field exists.
   */
  about?: string | null;
};
export type Cited = { url: string; fetchedOn: string };

/**
 * Number the pages the model is about to be shown.
 *
 * Deduplicated by url, because the same page can arrive as both a listing and
 * a competitor's page, and two numbers for one page is two ways to cite the
 * same fact. Order is the order given, so the numbers match the prompt.
 */
export function numberPages(pages: Page[]): Page[] {
  const seen = new Map<string, number>();
  const out: Page[] = [];
  for (const p of pages) {
    if (!p?.url) continue;

    // The same page read for two businesses covers both, so it stops belonging
    // to either. That is the honest answer and the safe one: a shared page can
    // source a fact about anybody on it, and refusing it would throw away a
    // real citation.
    const already = seen.get(p.url);
    if (already !== undefined) {
      if (out[already].about !== (p.about ?? null)) out[already].about = null;
      continue;
    }

    seen.set(p.url, out.length);
    out.push({ url: p.url, fetchedOn: p.fetchedOn, about: p.about ?? null });
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
  /**
   * A number, or a string of digits. Nothing else.
   *
   * This used to be `Number(from)`, which coerces: `Number(true)` is 1, and so
   * are `[1]` and anything with a valueOf. This is the one function whose
   * entire job is refusing what it did not hand out, so it cannot be the one
   * that quietly turns true into page one.
   */
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

// ---------------------------------------------------------------------------
// Whose page is this? Added 2026-09-16.
// ---------------------------------------------------------------------------

/**
 * A number that is real is not the same as a number that is right.
 *
 * `expand` refuses a page number we never handed out, which stops an invented
 * url. It does not ask whether the page it did expand has anything to do with
 * the business the fact is about, and nothing else asked either. So a cell in
 * the customer's own column could carry a genuine, live, clickable Booksy url
 * that was read for a competitor.
 *
 * That is worse than an invented url, not better. An invented one breaks when
 * somebody clicks it. This one opens a real page for a real business and looks
 * checked. An owner reads "this is what my rival charges" against the wrong
 * rival and prices against it.
 *
 * Found by an independent test pass on 2026-09-16, in the join between two
 * things that were each well tested on their own: page numbers expanding
 * correctly, and the grid being built correctly. Nothing tested across the
 * join. That is where to look next time.
 */

/** Names match the way the grid matches them: case and punctuation ignored. */
const same = (a: string, b: string) =>
  a.toLowerCase().replace(/[^a-z0-9]/g, "") === b.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * May this page source a fact about this business?
 *
 * Yes when the page covers the whole town, or when it was read for that exact
 * business. A page read for somebody else, no. A url we never read, no: we
 * cannot say whose it is, and "we do not know" must not read as "yes".
 */
export function belongsTo(list: Page[], url: string | null | undefined, business: string): boolean {
  if (!url) return false;
  const page = list.find((p) => p.url === url);
  if (!page) return false;
  return page.about == null || same(page.about, business);
}

/**
 * Blank every cell sourced to somebody else's page.
 *
 * Blanked, not corrected. We cannot know which page the fact really came from,
 * and guessing is how the wrong url got there. A blank cell is a state the
 * product already has and already reads well: not everybody publishes
 * everything.
 */
export function dropMisattributed<
  T extends {
    columns?: string[];
    rows?: { cells?: ({ value?: unknown; source?: { url?: string } | null } | null)[] }[];
  },
>(grids: T[], list: Page[]): { grids: T[]; dropped: number } {
  let dropped = 0;

  const grids2 = grids.map((g) => ({
    ...g,
    rows: (g.rows ?? []).map((row) => ({
      ...row,
      cells: (row.cells ?? []).map((cell, i) => {
        const business = g.columns?.[i];
        if (!cell || cell.value == null || !business) return cell;
        if (belongsTo(list, cell.source?.url, business)) return cell;
        dropped += 1;
        return { ...cell, value: null, source: null };
      }),
    })),
  })) as T[];

  return { grids: grids2, dropped };
}

/**
 * The same rule for the per business claims, which are read as prose rather
 * than as a table but say exactly the same kind of thing.
 */
export function dropMisattributedClaims<
  T extends { name: string; claims?: Record<string, { source?: { url?: string } | null }[]> },
>(competitors: T[], list: Page[]): { competitors: T[]; dropped: number } {
  let dropped = 0;

  const kept = competitors.map((c) => ({
    ...c,
    claims: Object.fromEntries(
      Object.entries(c.claims ?? {}).map(([area, claims]) => [
        area,
        (claims ?? []).filter((claim) => {
          // A claim with no source at all is the guards' business: they already
          // refuse it, and removing it here would hide it instead.
          if (!claim?.source?.url) return true;
          if (belongsTo(list, claim.source.url, c.name)) return true;
          dropped += 1;
          return false;
        }),
      ]),
    ),
  })) as T[];

  return { competitors: kept, dropped };
}
