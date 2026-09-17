/**
 * What competitors are paying to say. The Meta Ad Library.
 *
 * WHY THIS EXISTS
 * Everything else in Marketing & channels is presence: where a business shows
 * up. This is the only source that says what they think is worth money, in
 * their own words, with the date it started. Raj, 14 September 2026, on seeing
 * "Nobody's advertising was checked": isn't this a key marketing check? It is.
 *
 * WHAT IS SETTLED, AND WHAT IS NOT
 * Settled, from Meta's own ads_archive reference, read 14 September 2026:
 *   - `ad_reached_countries` is the one required parameter.
 *   - `ad_type` defaults to ALL, which "returns ads on all topics".
 *   - "Ads that did not reach any location in the EU will only return if they
 *     are about social issues, elections or politics."
 *
 * NOT settled: whether GB counts for that EU carve-out. Three secondary sources
 * say ads delivered to the UK or EU in the past year return whatever their
 * topic; a fourth says commercial ads are EU-only. Meta's own pages 403 every
 * automated read, so we could not check it against the primary source.
 *
 * This matters more than any other open question in the tool, because every one
 * of our customers is a UK small business. `probeCommercialCoverage` below
 * settles it in one call, the day a token exists. Until then the advertising
 * row stays empty and says why.
 */
import type { Claim, Source } from './types.ts';

const GRAPH = 'https://graph.facebook.com/v21.0/ads_archive';

/** Fields that exist for an ordinary commercial ad. Political ads carry more. */
export const COMMERCIAL_FIELDS = [
  'id', 'page_name', 'ad_creation_time', 'ad_delivery_start_time',
  'ad_delivery_stop_time', 'ad_creative_bodies', 'ad_creative_link_titles',
  'ad_snapshot_url', 'publisher_platforms',
] as const;

/**
 * Spend, impressions and demographics are published for political and issue ads
 * only. Asking for them on a commercial query returns nothing, and printing a
 * blank as a zero would say a competitor spent nothing. Never request these.
 */
export const POLITICAL_ONLY_FIELDS = ['spend', 'impressions', 'demographic_distribution', 'delivery_by_region'] as const;

export interface AdQuery {
  /** The competitor, as their Facebook page names them. */
  advertiser: string;
  /** ISO codes. GB for a UK business. */
  countries?: string[];
  limit?: number;
}

export function buildAdArchiveQuery(q: AdQuery, token: string): string {
  const params = new URLSearchParams({
    search_terms: q.advertiser,
    ad_reached_countries: JSON.stringify(q.countries ?? ['GB']),
    ad_type: 'ALL',
    ad_active_status: 'ALL',
    fields: COMMERCIAL_FIELDS.join(','),
    limit: String(q.limit ?? 25),
    access_token: token,
  });
  return `${GRAPH}?${params}`;
}

export interface RawAd {
  id: string;
  page_name?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[];
  ad_snapshot_url?: string;
  publisher_platforms?: string[];
}

/**
 * Ad copy is written by the competitor. It is fetched text, so it is
 * information and never instruction, exactly like their website. It reaches the
 * battlecard as a quote with a source and a date, and nothing else.
 */
export function adsToClaims(ads: RawAd[], readOn: string): Claim[] {
  if (ads.length === 0) {
    return [{
      text: 'No ads running that the Meta Ad Library shows for the United Kingdom',
      value: 0,
      source: { url: 'https://www.facebook.com/ads/library/', fetchedOn: readOn },
    }];
  }
  return ads.map(ad => {
    const body = (ad.ad_creative_bodies?.[0] ?? '').replace(/\s+/g, ' ').trim();
    const started = ad.ad_delivery_start_time?.slice(0, 10);
    const source: Source = {
      url: ad.ad_snapshot_url ?? `https://www.facebook.com/ads/library/?id=${ad.id}`,
      fetchedOn: readOn,
    };
    return {
      text: `Running since ${started ?? 'an unstated date'}: "${truncate(body, 140)}"`,
      value: started ?? ad.id,
      source,
    };
  });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

/* ── The one call that settles the open question ──────────────────────────── */

export type CoverageVerdict =
  | { covered: true; evidence: string }
  | { covered: false; evidence: string }
  | { covered: 'unknown'; evidence: string };

/**
 * Ask for ads in GB that are plainly commercial, and see whether any come back.
 *
 * Run this once, the day the token exists, before writing a line of product
 * copy about advertising. If GB is not covered, the whole feature is EU-only
 * and the honest answer to a UK customer is that we cannot see it.
 */
export async function probeCommercialCoverage(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CoverageVerdict> {
  const url = buildAdArchiveQuery({ advertiser: 'barber', countries: ['GB'], limit: 5 }, token);
  const res = await fetchImpl(url);
  if (!res.ok) {
    return { covered: 'unknown', evidence: `Ad Library returned HTTP ${res.status}` };
  }
  const body = (await res.json()) as { data?: RawAd[] };
  const ads = body.data ?? [];
  if (ads.length === 0) {
    // Nothing came back. That is not proof of no coverage: it could be the
    // search term. Widen it before concluding anything.
    return { covered: 'unknown', evidence: 'No ads returned for "barber" in GB. Try other terms before concluding' };
  }
  return { covered: true, evidence: `${ads.length} commercial ads returned for GB, e.g. ${ads[0].page_name ?? ads[0].id}` };
}

/* ── What we say while there is no token ──────────────────────────────────── */

/**
 * The empty cell, with its reason attached. `findUnexplainedGaps` rejects a bare
 * "Not checked", and this is the text that satisfies it.
 */
export const NOT_YET_AVAILABLE: Claim = {
  text: 'Not checked: the Meta Ad Library needs an API access we have not applied for yet',
  value: null,
  source: null,
};
