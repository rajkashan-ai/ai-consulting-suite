/**
 * Who comes up when a customer searches.
 *
 * WHY THIS EXISTS
 * For a local business this is the marketing question. A barber does not care
 * what a rival pays Meta; they care that the rival comes up for "barber
 * Shrewsbury" and they do not come up at all.
 *
 * THE ONE THING THAT WOULD HAVE MADE THIS WRONG
 * A server-side search has no location. Run bare, "barber Shrewsbury" returns
 * Shrewsbury Pennsylvania and Shrewsbury Massachusetts ahead of the real one,
 * and we would have produced a confidently wrong competitor list for every UK
 * business. `user_location` fixes it, and `searchToolConfig` never omits it.
 *
 * WHAT WE MAY AND MAY NOT SAY
 * A search result is not a ranking. We can say who appears and who does not,
 * and count it across several searches. We can never say someone is ninth on
 * Google: that is a number nobody gave us. `findRankClaims` in guards.ts is the
 * test that keeps it out.
 */
import type { Claim } from './types.ts';
import { normaliseName, sameBusiness } from './normalise.ts';

export interface SearchProfile {
  name: string;
  /** What they are, in the word a customer would type. "barber", "plumber". */
  trade: string;
  town: string;
  region?: string;
  /** ISO 3166-1 alpha-2. GB for a UK business. */
  country: string;
  /** IANA id, e.g. Europe/London. */
  timezone?: string;
  services: string[];
  website?: string;
}

export interface SearchTerm {
  term: string;
  /** Said on screen, so the customer can correct a term that is wrong for them. */
  why: string;
}

export const TERMS_PER_RUN = 5;

/**
 * The terms a real customer types, worked out from the profile.
 *
 * Never the business's own name. Searching for yourself returns yourself, tells
 * you nothing, and burns one of the five searches we pay for.
 */
export function buildSearchTerms(p: SearchProfile): SearchTerm[] {
  const trade = p.trade.toLowerCase().trim();
  const town = p.town.trim();
  const terms: SearchTerm[] = [
    { term: `${trade} ${town}`, why: 'What most people type' },
    { term: `${trade} near me`, why: 'What people type on a phone' },
    { term: `best ${trade} ${town}`, why: 'What people type when they are choosing, not just looking' },
  ];

  // Two service terms, because a specific job is a different search from a trade.
  for (const service of p.services.slice(0, 2)) {
    const s = service.toLowerCase().replace(/\s*&\s*/g, ' and ').trim();
    terms.push({ term: `${s} ${town}`, why: `Someone who wants a ${s}, not just a ${trade}` });
  }

  return terms
    .filter(t => !containsOwnName(t.term, p.name))
    .slice(0, TERMS_PER_RUN);
}

function containsOwnName(term: string, ownName: string): boolean {
  const t = normaliseName(term);
  const own = normaliseName(ownName);
  if (!own) return false;
  // The distinctive part of the name, not the trade or town words it shares.
  const distinctive = own.split(' ').filter(w => w.length > 3 && !t.split(' ').includes(w));
  return distinctive.length === 0;
}

/** The web search tool definition. `user_location` is not optional here. */
export function searchToolConfig(p: SearchProfile, maxUses = TERMS_PER_RUN) {
  return {
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: maxUses,
    user_location: {
      type: 'approximate' as const,
      city: p.town,
      ...(p.region ? { region: p.region } : {}),
      country: p.country,
      ...(p.timezone ? { timezone: p.timezone } : {}),
    },
  };
}

export interface SearchResult {
  url: string;
  title: string;
}

export type Who =
  | { kind: 'you' }
  | { kind: 'venue'; site: string; url: string }
  | { kind: 'competitor'; name: string }
  | { kind: 'directory'; site: string }
  | { kind: 'other' };

/**
 * Platforms that list many businesses. A result on one of these is a directory
 * unless the URL or title names a specific business we are tracking, in which
 * case it is that business.
 */
const DIRECTORIES = [
  'booksy.com', 'fresha.com', 'treatwell', 'yell.com', 'yelp.com', 'yelp.co.uk',
  'tripadvisor', 'thomsonlocal', 'checkatrade', 'ratedpeople', 'mybuilder',
  'bark.com', 'nextdoor', 'trustpilot', 'google.com/maps', 'facebook.com',
  'instagram.com',
  // Added 14 Sep after a real run offered "The 10 best barbers in Shrewsbury"
  // as a competitor. A top-ten page is a directory, not a business.
  'starofservice', 'yellowpages', 'scoot.co.uk', 'freeindex', 'cylex',
];

export function classify(result: SearchResult, p: SearchProfile, competitors: string[]): Who {
  const haystack = `${result.url} ${result.title}`;

  if (p.website && sameHost(result.url, p.website)) return { kind: 'you' };
  if (namesBusiness(haystack, p.name)) return { kind: 'you' };

  for (const name of competitors) {
    if (namesBusiness(haystack, name)) return { kind: 'competitor', name };
  }

  const directory = DIRECTORIES.find(d => result.url.toLowerCase().includes(d));
  if (directory) {
    // A PLATFORM PAGE IS NOT ONE THING.
    //
    // Booksy serves two completely different pages from one host: a listing
    // ("/en-gb/s/barber/1227928_shrewsbury" — the top ten in a town) and a
    // venue ("/en-gb/12884_hinces_barber_1227928_shrewsbury" — one business).
    // Until 15 September both came back as `directory`, so every competitor on
    // the platform was thrown away as a listicle. Discovery found nobody on the
    // one site where nearly every small business actually is, and 35 passing
    // tests never noticed because they only ever used independent websites.
    return isVenuePage(result.url)
      ? { kind: 'venue', site: directory, url: result.url }
      : { kind: 'directory', site: directory };
  }

  return { kind: 'other' };
}

/**
 * One business, or a list of them?
 *
 * Listings live under a search path — /s/, /search/, /top, /near-me. A venue
 * carries its own id in the path. Judged on the path shape rather than a
 * per-platform rule, because the next platform will have a different scheme and
 * the same two kinds of page.
 */
export function isVenuePage(url: string): boolean {
  let path = '';
  try { path = new URL(url).pathname.toLowerCase(); } catch { return false; }
  if (/(^|\/)(s|search|browse|top|near-me|categories?)(\/|$)/.test(path)) return false;
  // A venue id: a run of digits in its own path segment, as Booksy and Fresha
  // both use, or a long slug that is clearly one name.
  return /\/\d{3,}[_-]/.test(path) || /\/lvp\//.test(path);
}

/**
 * Which country a platform result is for.
 *
 * "Shrewsbury" is a town in Shropshire, in Pennsylvania, in Massachusetts and
 * in New Jersey. A search for "barber Shrewsbury" run without a location
 * returns Pennsylvania and Massachusetts, and the only UK result is the
 * customer themselves — measured on 15 September. The production path sets
 * user_location on the search tool, but a result still has to be checked:
 * a request for the UK that comes back with /en-us/ in the path is not a
 * competitor, it is a different Shrewsbury.
 */
export function resultCountry(url: string): string | null {
  const u = url.toLowerCase();

  // booksy.com/en-gb/..., and the /en-us/ that started this.
  const tagged = u.match(/\/en-([a-z]{2})\//);
  if (tagged) return tagged[1].toUpperCase();

  /**
   * fresha.com/lp/en/bt/hair-salons/in/au-melbourne/st-albans
   *
   * A second shape, and the one that cost a real report on 2026-09-17. This
   * function knew only the /en-xx/ shape, so it returned null for that url and
   * passed it as "cannot tell". There is a St Albans in Melbourne, and twenty
   * one of the ninety four businesses read off that page were Australian.
   */
  const placed = u.match(/\/in\/([a-z]{2})-[a-z]/);
  if (placed) return placed[1].toUpperCase() === 'UK' ? 'GB' : placed[1].toUpperCase();

  if (/\.co\.uk(\/|$)/.test(u)) return 'GB';
  if (/\/us\/|\.com\/us(\/|$)/.test(u)) return 'US';
  return null;
}

function sameHost(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, '');
    const hb = new URL(b.startsWith('http') ? b : `https://${b}`).hostname.replace(/^www\./, '');
    return ha === hb;
  } catch {
    return false;
  }
}

/**
 * Does this result name that business?
 *
 * The whole name, as a run of consecutive words. Matching word by word looked
 * reasonable and was badly wrong: "NO.1 Barbers" reduces to the single
 * distinctive word "barbers", so every page mentioning barbers was attributed
 * to them. A phrase cannot do that.
 */
function namesBusiness(haystack: string, name: string): boolean {
  const needle = normaliseName(name);
  if (needle.length < 3) return false;
  return ` ${normaliseName(haystack)} `.includes(` ${needle} `);
}

export interface Visibility {
  term: string;
  youAppear: boolean;
  competitors: string[];
  directories: string[];
}

export function measure(term: string, results: SearchResult[], p: SearchProfile, competitors: string[]): Visibility {
  const v: Visibility = { term, youAppear: false, competitors: [], directories: [] };
  for (const r of results) {
    const who = classify(r, p, competitors);
    if (who.kind === 'you') v.youAppear = true;
    else if (who.kind === 'competitor' && !v.competitors.includes(who.name)) v.competitors.push(who.name);
    else if (who.kind === 'directory' && !v.directories.includes(who.site)) v.directories.push(who.site);
  }
  return v;
}

/**
 * The findings, as counts.
 *
 * "You come up in 1 of 5 searches, HINCES comes up in 4" is a number we can
 * show our working for. "You are ninth" is not.
 */
export function summarise(
  seen: Visibility[],
  p: SearchProfile,
  competitors: string[],
  readOn: string,
): Claim[] {
  const total = seen.length;
  if (total === 0) return [];
  const source = { url: 'https://www.google.com/search', fetchedOn: readOn };

  const yours = seen.filter(v => v.youAppear).length;
  const claims: Claim[] = [{
    text: `You come up in ${yours} of ${total} searches a customer would run`,
    value: yours,
    source,
  }];

  for (const name of competitors) {
    const n = seen.filter(v => v.competitors.includes(name)).length;
    claims.push({ text: `${name} comes up in ${n} of ${total}`, value: n, source });
  }

  // Where a directory outranks every actual business, the way in is to be listed
  // on it, not to try to beat it. This is the line that points at Booksy.
  const dirOnly = seen.filter(v => !v.youAppear && v.competitors.length === 0 && v.directories.length > 0);
  if (dirOnly.length > 0) {
    claims.push({
      text: `${dirOnly.length} of ${total} searches return only directory listings, not any barber's own site. ` +
            `Being on ${[...new Set(dirOnly.flatMap(v => v.directories))].join(', ')} is the way in`,
      value: dirOnly.length,
      source,
    });
  }

  const missing = seen.filter(v => !v.youAppear && v.competitors.length > 0);
  for (const v of missing) {
    claims.push({
      text: `You do not come up for "${v.term}". ${v.competitors.join(', ')} do`,
      value: v.competitors.length,
      source,
    });
  }
  return claims;
}

/* ── What the search finds that the list has missed ───────────────────────── */

export interface Candidate {
  name: string;
  url: string;
  /** How many of the searches they came up in. */
  seenIn: number;
}

/**
 * Businesses that keep coming up and are not on the list.
 *
 * Found by this tool on its first real run, 14 September 2026. The five
 * competitors are picked by Booksy review count, and four of the five did not
 * come up in a search at all, while two shops with their own websites did and
 * were on nobody's list. Picking by review volume finds the businesses that are
 * good at Booksy, which is not the same as the businesses taking the work.
 *
 * So the search now feeds the list back. We never add anyone silently: these are
 * offered under the table, and the customer decides.
 */
export function candidatesFromSearch(
  seen: { term: string; results: SearchResult[] }[],
  p: SearchProfile,
  competitors: string[],
): Candidate[] {
  const counts = new Map<string, Candidate>();
  const trade = normaliseName(p.trade);
  const town = normaliseName(p.town);

  for (const { results } of seen) {
    const thisTerm = new Set<string>();
    for (const r of results) {
      const who = classify(r, p, competitors);
      // `other` is a business with its own website. `venue` is a business on a
      // platform. Both are candidates; only one of them used to be. Keying on
      // the host discarded the second kind twice over — once by classifying it
      // as a directory, and again by collapsing every venue on booksy.com into
      // a single entry, so five barbers on one platform could only ever yield
      // one candidate.
      if (who.kind !== 'other' && who.kind !== 'venue') continue;

      // A different country's town of the same name is not a competitor.
      const country = resultCountry(r.url);
      if (country && p.country && country !== p.country.toUpperCase()) continue;

      const hay = normaliseName(`${r.url} ${r.title}`);
      // In the same trade or the same town, or it is not a competitor at all.
      // A Wikipedia article and a "top ten" listicle both fail this.
      const relevant = hay.includes(trade.replace(/s$/, '')) || hay.includes(town);
      if (!relevant) continue;

      // Keyed by the venue, not the host: one business, wherever it is listed.
      const key = who.kind === 'venue' ? venueKey(r.url) : hostOf(r.url);
      if (!key || thisTerm.has(key)) continue;
      thisTerm.add(key);

      const existing = counts.get(key);
      if (existing) existing.seenIn += 1;
      else counts.set(key, { name: tidyTitle(r.title, p.town, r.url), url: r.url, seenIn: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.seenIn - a.seenIn);
}

/** One business on a platform, identified by its own path rather than the host
 *  it shares with every other business on that platform. */
function venueKey(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '').toLowerCase();
  } catch { return null; }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Pull a business name out of a search title.
 *
 * Titles carry a tail and often lead with the branch: "SHREWSBURY - Headcase
 * Barbers | United Kingdom". Taking the first segment gave us a candidate
 * called "SHREWSBURY", which is a town, not a competitor.
 */
function tidyTitle(title: string, town: string, url: string): string {
  // A hyphenated hostname is almost always the trading name, and it beats the
  // title every time. "Men's Beard Trim - Barber - Bridgette The Mobile Barber"
  // gave a candidate called "Men's Beard Trim"; the host did not.
  const fromHost = nameFromHost(url);
  if (fromHost) return fromHost;

  const parts = title.split(/\s+[|–—-]\s+/).map(s => s.trim()).filter(Boolean);
  const townN = normaliseName(town);
  const named = parts.find(s => {
    const n = normaliseName(s);
    return n.length > 3 && n !== townN && !GENERIC.has(n);
  });
  return named ?? parts[0] ?? title.trim();
}

function nameFromHost(url: string): string | null {
  const host = hostOf(url);
  if (!host) return null;
  const label = host.split('.')[0];
  if (!label.includes('-')) return null;      // one word tells us nothing
  return label.split('-')
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

const GENERIC = new Set([
  'home', 'book online', 'united kingdom', 'uk', 'england', 'official site',
  'welcome', 'contact', 'prices', 'about us',
]);
