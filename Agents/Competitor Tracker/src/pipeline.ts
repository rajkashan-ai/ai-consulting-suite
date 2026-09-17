/**
 * The whole run, as one function, so the server and the command line cannot
 * drift into doing it two slightly different ways.
 *
 * Reports progress as it goes. The screen does not show partial results — that
 * was decided — but the server still needs to know how far along it is, and a
 * run that says what it is doing is far easier to debug than one that returns
 * after twenty seconds with a result or an exception.
 */
import { buildProfile, pagePathsFrom, pricePagePath } from './profile.ts';
import { fetchPage, fetchAll, isFetched } from './fetch-pages.ts';
import { buildSearchTerms, candidatesFromSearch } from './search-visibility.ts';
import { planFor, coreServiceWords } from './discovery-routes.ts';
import { venueFrom, comparableTo } from './venue.ts';
import type { RunSnapshot } from './changes.ts';

export interface Progress { step: string; done: number; of: number }
export type OnProgress = (p: Progress) => void;

export interface PipelineResult {
  ok: boolean;
  /** Present when ok is false: what could not be read, in plain words. */
  stopped?: string;
  profile?: ReturnType<typeof buildProfile> extends infer R ? any : never;
  services?: { name: string; price: number }[];
  street?: string; postcode?: string;
  anchor?: { name: string; price: number } | null;
  anchorNote?: string;
  competitors: {
    name: string; url: string;
    reviewCount?: number; rating?: number;
    match?: { name: string; low: number; high: number; tiers: number } | null;
    unread?: string;
  }[];
  plan?: ReturnType<typeof planFor>;
  discoveryNote?: string;
  readOn?: string;
  /** The shape `changes.ts` compares. Kept deliberately small — what we store
   *  for a week is the facts, not the rendered page. */
  snapshot?: RunSnapshot;
}

const STEPS = 5;

export async function runFor(
  input: string,
  searchResults: { term: string; results: { url: string; title: string }[] }[],
  onProgress: OnProgress = () => {},
): Promise<PipelineResult> {
  const say = (step: string, done: number) => onProgress({ step, done, of: STEPS });

  say('Reading their website', 0);
  const home = await fetchPage(input);
  if (!isFetched(home)) {
    return { ok: false, stopped: `We could not read ${input} — it returned ${home.failed}.`, competitors: [] };
  }

  say('Finding their price list', 1);
  const path = pricePagePath(pagePathsFrom(home.html));
  const price = path ? await fetchPage(new URL(home.url).origin + path) : null;

  const built = buildProfile(home.html, price && isFetched(price) ? price.html : '', input);
  if (!built.ok) {
    return { ok: false, stopped: `We read the site but could not work out ${built.missing.join(', ')}.`, competitors: [] };
  }
  const { profile, services, street, postcode } = built;

  say('Working out where this trade lists itself', 2);
  const plan = planFor(profile.trade);
  if (plan.cannotProceed) {
    return { ok: false, stopped: plan.cannotProceed, competitors: [], profile, services, plan };
  }

  say('Finding competitors', 3);
  const terms = buildSearchTerms(profile);
  const candidates = candidatesFromSearch(searchResults, profile, []).slice(0, 5);
  const discoveryNote = `${terms.length} searches, ${candidates.length} found on ${plan.usable.map(u => u.host).join(' and ')}`;

  say('Reading each competitor', 4);
  const pages = await fetchAll(candidates.map(c => c.url));
  const venues = candidates.map((c, i) => {
    const page = pages[i];
    return isFetched(page) ? { c, v: venueFrom(page.html) } : { c, failed: page.failed };
  });

  // The anchor: the trade's core job, plainly named, dearest of those.
  const core = coreServiceWords(profile.trade);
  const isCombined = (n: string) => /\binc\b|\band\b|&/i.test(n);
  const anchor = (core ? services.filter(s => core.some(w => s.name.toLowerCase().includes(w))) : [])
    .filter(s => !isCombined(s.name))
    .sort((a, b) => b.price - a.price)[0] ?? null;

  const competitors = venues.map(x => x.failed
    ? { name: x.c.name, url: x.c.url, unread: `their page returned ${x.failed}` }
    : {
        name: x.v.name ?? x.c.name, url: x.c.url,
        reviewCount: x.v.reviewCount, rating: x.v.rating,
        match: anchor ? comparableTo(anchor.name, x.v.services, core) : null,
      });

  say('Done', 5);
  return {
    ok: true, profile, services, street, postcode, anchor,
    anchorNote: anchor
      ? `${anchor.name} £${anchor.price} — the core job for a ${profile.trade}`
      : `we have not recorded what job a ${profile.trade} is judged on`,
    competitors, plan, discoveryNote, readOn: home.readOn,
    snapshot: {
      ranAt: new Date().toISOString(),
      ownHeadlinePrice: anchor?.price,
      competitors: competitors.map(c => ({
        name: c.name,
        reviewCount: c.reviewCount,
        rating: c.rating,
        headlinePrice: c.match?.high,
        unread: Boolean(c.unread),
      })),
    },
  };
}
