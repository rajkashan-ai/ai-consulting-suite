/**
 * Step 2: from a URL alone, work out what the business is.
 *
 * Everything downstream is built on this. The search terms are "<trade> <town>",
 * the competitor set is other businesses of that trade, and the price comparison
 * is against the customer's own headline service. Get the trade wrong and the
 * whole run is wrong in a way no later guard can catch, because every claim will
 * be correctly sourced and about the wrong market.
 *
 * Pure, like the rest of src/. It is handed HTML and returns a profile; the
 * fetching lives in fetch-pages.ts so this stays testable without a network.
 */
import type { SearchProfile } from './search-visibility.ts';

export interface PricedService { name: string; price: number }

/**
 * schema.org LocalBusiness, if the site publishes it.
 *
 * The Shrewsbury barber's site is 475KB of Wix with 237 visible words and no
 * plain links at all — the navigation is built by script. The JSON-LD block is
 * the only structured thing on the page, and it carries the name, the street,
 * the town and the country. Where a site publishes this, it beats anything we
 * could infer from prose, so it is tried first.
 */
export function fromStructuredData(html: string): Partial<SearchProfile> & { street?: string; postcode?: string } {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try { parsed = JSON.parse(m[1]); } catch { continue; }   // a broken block is not a broken page
    for (const node of (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, any>[]) {
      const type = String(node?.['@type'] ?? '');
      if (!/LocalBusiness|HairSalon|BarberShop|HealthAndBeautyBusiness|Store/i.test(type)) continue;
      const a = node.address ?? {};
      return {
        name: typeof node.name === 'string' ? node.name.trim() : undefined,
        town: typeof a.addressLocality === 'string' ? a.addressLocality.trim() : undefined,
        country: typeof a.addressCountry === 'string' ? a.addressCountry.trim() : undefined,
        website: typeof node.url === 'string' ? node.url : undefined,
        street: typeof a.streetAddress === 'string' ? a.streetAddress.trim() : undefined,
        postcode: typeof a.postalCode === 'string' ? a.postalCode.trim() : undefined,
      };
    }
  }
  return {};
}

/** Trades we can name. Ordered: the first match wins, so put the specific
 *  before the general — a "barber" is also a "hairdresser" and the search term
 *  a customer types is the specific one. */
const TRADES: [string, RegExp][] = [
  ['barber',       /\bbarber(?:s|ing|shop)?\b/i],
  ['hairdresser',  /\bhairdress(?:er|ing|ers)\b|\bhair salon\b/i],
  ['plumber',      /\bplumb(?:er|ers|ing)\b/i],
  ['electrician',  /\belectrician(?:s)?\b/i],
  ['beautician',   /\bbeauty salon\b|\bbeautician\b/i],
  ['nail salon',   /\bnail(?:s)? (?:bar|salon)\b/i],
  ['tattooist',    /\btattoo(?:ist|s)?\b/i],
  ['builder',      /\bbuilder(?:s)?\b/i],
];

/**
 * The word a customer would type, counted rather than guessed.
 *
 * Returns null when nothing is confident, and null is a real answer: a run
 * built on the wrong trade is worse than a run that stops and asks. The
 * threshold is deliberately low (two mentions) because these pages carry very
 * little prose — the barber's homepage says "barber" seven times in 237 words,
 * which is plenty, but a one-word fluke should not decide a whole run.
 */
export function tradeFrom(html: string, minMentions = 2): { trade: string; mentions: number } | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  let best: { trade: string; mentions: number } | null = null;
  for (const [trade, re] of TRADES) {
    const n = (text.match(new RegExp(re.source, 'gi')) ?? []).length;
    if (n >= minMentions && (!best || n > best.mentions)) best = { trade, mentions: n };
  }
  return best;
}

/**
 * Where else on this site to look.
 *
 * Wix, Squarespace and Wordpress all render navigation with script, so the
 * homepage of a small business often contains no usable <a href> at all. The
 * barber's had none. Page names survive in the router's own JSON, which is why
 * this reads those rather than links.
 */
export function pagePathsFrom(html: string): string[] {
  const paths = new Set<string>();
  for (const m of html.matchAll(/"(?:pageUriSEO|relativeUrl)"\s*:\s*"([a-z0-9\-\/]{2,40})"/gi)) {
    paths.add(m[1].startsWith('/') ? m[1] : '/' + m[1]);
  }
  for (const m of html.matchAll(/<a[^>]+href="(\/[a-z0-9\-\/]{2,40})"/gi)) paths.add(m[1]);
  return [...paths];
}

/** The page most likely to carry prices, or null. */
export function pricePagePath(paths: string[]): string | null {
  return paths.find(p => /price|menu|services|rates|tariff|cost/i.test(p)) ?? null;
}

/**
 * "Clipper Cut £8.00" and nothing else.
 *
 * Deliberately strict: a service name, then a price, on one line. A looser
 * pattern picks up "from £8", "£8 deposit" and every phone number that happens
 * to follow a pound sign. Five services came out of the barber's price page and
 * all five were right; a sixth wrong one would have been worse than four right.
 */
/** Words that introduce a price rather than name a thing you can buy. */
const NOT_A_SERVICE = new Set([
  'from', 'to', 'only', 'each', 'per', 'plus', 'and', 'or', 'with',
  'starting at', 'starting from', 'prices from', 'was', 'now', 'save',
]);

export function servicesFrom(html: string): PricedService[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&pound;/g, '£')
    .split('\n').map(s => s.trim()).filter(Boolean).join('\n');

  const out: PricedService[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/^(.{3,44}?)\s*[-–—:]?\s*£\s?(\d+(?:\.\d\d)?)$/gm)) {
    const name = m[1].trim();
    if (!/^[A-Za-z][A-Za-z &'\/-]{2,43}$/.test(name)) continue;   // not a sentence, not a number
    // "from £8" is a price hint, not a service called "from". Same for the
    // handful of words that only ever introduce a price. Caught by a test
    // written before the fix, because the first version of this happily
    // returned a service named "from".
    if (NOT_A_SERVICE.has(name.toLowerCase())) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, price: Number(m[2]) });
  }
  return out;
}

export type ProfileResult =
  | { ok: true; profile: SearchProfile; services: PricedService[]; street?: string; postcode?: string }
  | { ok: false; missing: string[] };

/**
 * Assemble, and refuse rather than guess.
 *
 * `missing` is the useful failure: it names what could not be read so the screen
 * can ask the owner for that one thing instead of showing a confident run built
 * on a hole.
 */
export function buildProfile(homeHtml: string, priceHtml: string, url: string): ProfileResult {
  const sd = fromStructuredData(homeHtml);
  const t = tradeFrom(homeHtml);
  const services = servicesFrom(priceHtml);

  const missing: string[] = [];
  if (!sd.name) missing.push('the business name');
  if (!t) missing.push('what trade this is');
  if (!sd.town) missing.push('which town');
  if (!sd.country) missing.push('which country');
  if (missing.length) return { ok: false, missing };

  return {
    ok: true,
    profile: {
      name: sd.name!,
      trade: t!.trade,
      town: sd.town!,
      country: sd.country!,
      services: services.map(s => s.name),
      website: sd.website ?? url,
    },
    services,
    street: sd.street,
    postcode: sd.postcode,
  };
}
