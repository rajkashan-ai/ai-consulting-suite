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
    `not go in the post.\n\nThe number goes in "from" and nowhere else. Never ` +
    `write [1] or [2] in the words themselves: they are a post somebody pastes ` +
    `into Instagram, not a paper.`
  );
}

/**
 * Whether there is enough of their own site to write a post from.
 *
 * WHY THIS IS A RULE AND NOT AN `IF`
 * Every post has to cite a page on their own site, and `unsafe` refuses one
 * that does not. With nothing read there is no post that could pass, so the
 * model must never be called: paying for an answer we already know we will
 * refuse is the waste this stops. It was written inline in one screen's action,
 * which meant the next screen that writes a post would have had to remember it.
 *
 * A page that was fetched and came back broken is not a page. `read` is
 * whatever came back ok, so a site we tried and failed on is zero, not some.
 *
 * Returns the sentence the owner sees, or null to go ahead.
 */
export function tooThinToWrite(
  pages: readonly Page[],
  read: readonly { ok: boolean }[],
): string | null {
  if (pages.length && read.some((p) => p.ok)) return null;
  return "We have not read your website yet. Run the planner once and then come back.";
}

/**
 * The services to offer beside a photo, best first.
 *
 * Read off their own site rather than typed here, for the reason everything
 * else in this tool is: a list we invent contains services they do not sell,
 * and the owner picking one would have us write a post about work they do not
 * do. Priced ones come first because a photo paired with one of those can carry
 * a real price and a real booking line, which is the whole point of the pairing.
 *
 * Takes the shape rather than a Business, so this file stays free of the
 * workspace types and can be tested with two objects.
 */
export function servicesToOffer(
  services: readonly { name: string; price?: string | null }[] | null | undefined,
): string[] {
  if (!services?.length) return [];
  const named = services.filter((s) => s?.name?.trim());
  const priced = named.filter((s) => s.price).map((s) => s.name.trim());
  const rest = named.filter((s) => !s.price).map((s) => s.name.trim());
  return [...new Set([...priced, ...rest])];
}

/**
 * What the owner reads under a post, saying what is actually behind it.
 *
 * Two sources, not one, on the photo path. The page backs the price and the
 * booking line; the photo backs the description of the work. Stamping a post
 * that describes a haircut with "from your own page" would point the receipt at
 * something that does not say it, and that line is the whole promise of this
 * tool: the moment it points at the wrong thing it is decoration.
 */
export function creditLine(
  fromPhoto: boolean,
  readOn: string | null,
  photoOn: string | null,
): string {
  const page = `your own page${readOn ? `, read ${readOn}` : ""}`;
  if (!fromPhoto) return `From ${page}`;
  return `From your photo${photoOn ? `, added ${photoOn}` : ""}, and ${page}`;
}

/**
 * The greyed example in the notes box, built from their own price list.
 *
 * WHY NOT A WRITTEN EXAMPLE
 * A placeholder showing "Balayage, £95" to a barber is us inventing a service
 * and a price for somebody else's business, in the one product whose whole
 * promise is that it does not. Their own priced services are the only honest
 * example, and they are already on the run.
 *
 * Two, because a placeholder long enough to read is a placeholder that gets in
 * the way of the box it is in. Priced first, so the example shows a price,
 * which is the half people forget to mention.
 *
 * A business we could read no services for gets the shape without the example.
 * It still says what to write; it just cannot show them.
 */
export function notesHint(
  services: readonly { name: string; price?: string | null }[] | null | undefined,
): string {
  const named = (services ?? []).filter((s) => s?.name?.trim());
  const priced = named.filter((s) => s.price);

  /**
   * Two DIFFERENT services, not one service twice.
   *
   * A Cut Above's price list is twelve grades of the same cut, "Ladies Cut &
   * Finish - Graduate Stylist" through to "- Creative Director", which is the
   * list that made the old picker unusable in the first place. Taking the first
   * two produced "Ladies Cut & Finish - Graduate Stylist, £51.00. Ladies Cut &
   * Finish - Stylist, £57.00", which shows the shape twice and the range once.
   *
   * So the grade is dropped for the purpose of telling two services apart, and
   * the first of each family is shown with its own real price.
   */
  const family = (name: string) => name.split(/\s[-–:]\s/)[0].trim().toLowerCase();
  const distinct: typeof named = [];
  for (const s of [...priced, ...named.filter((x) => !x.price)]) {
    if (distinct.some((d) => family(d.name) === family(s.name))) continue;
    distinct.push(s);
    if (distinct.length === 2) break;
  }
  const show = distinct;

  if (!show.length) return "What is in the photo, what it costs, anything worth saying";

  const bits = show.map((s) => (s.price ? `${s.name.trim().split(/\s[-–:]\s/)[0].trim()}, ${s.price}` : s.name.trim()));
  return `${bits.join(". ")}. Anything else worth saying`;
}
