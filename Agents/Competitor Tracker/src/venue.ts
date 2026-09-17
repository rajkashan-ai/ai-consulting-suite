/**
 * A competitor's page on a booking platform, turned into facts.
 *
 * Booksy publishes schema.org on every venue: HairSalon with an aggregateRating,
 * a postal address, a price range and an array of dated reviews. That is more,
 * and better sourced, than anything scraped out of the rendered page, so it is
 * read first and the prose is only a fallback.
 *
 * Pure, like everything else in src/. Handed HTML, returns facts.
 */
import type { Claim, Source } from './types.ts';

export interface VenueService { name: string; low: number; high: number; tiers: number }
export interface VenueReview { on: string; body: string }

export interface Venue {
  name?: string;
  rating?: number;
  reviewCount?: number;
  town?: string;
  street?: string;
  services: VenueService[];
  reviews: VenueReview[];
}

const unescapeJson = (s: string) =>
  s.replace(/\\u0026/g, '&').replace(/\\u2019/g, '’').replace(/\\"/g, '"').replace(/\\\//g, '/');

/**
 * ONE SERVICE, SEVERAL PRICES.
 *
 * HINCES lists "Classic Haircut" four times — £35, £30, £20 and £17 — one per
 * stylist tier. There is no single price, and picking one silently is how a
 * comparison becomes an opinion. The person who built the screen by hand chose
 * £35, the top tier, and that is the defensible choice: it is what the business
 * charges for that service at its own headline rate, and it is the number the
 * business itself leads with.
 *
 * Both ends are kept and the number of tiers is kept, so a claim can say "£35,
 * their top of four tiers" rather than "£35" flatly. A price with a hidden
 * range behind it is the same defect as a count with no boundary.
 */
export function servicesFrom(html: string): VenueService[] {
  const byName = new Map<string, number[]>();
  for (const m of html.matchAll(
    /"name"\s*:\s*"([^"]{3,44})"[^}]{0,200}?"(?:price|variantPrice|servicePrice)"\s*:\s*"?(\d+(?:\.\d+)?)/gi)) {
    const name = unescapeJson(m[1]).trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 &'’\/()-]{2,43}$/.test(name)) continue;
    const list = byName.get(name) ?? [];
    list.push(Number(m[2]));
    byName.set(name, list);
  }
  return [...byName].map(([name, prices]) => ({
    name,
    low: Math.min(...prices),
    high: Math.max(...prices),
    tiers: new Set(prices).size,
  }));
}

/** The schema.org block, which is where the numbers that matter live. */
export function venueFrom(html: string): Venue {
  const out: Venue = { services: servicesFrom(html), reviews: [] };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try { parsed = JSON.parse(m[1]); } catch { continue; }
    for (const node of (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, any>[]) {
      if (!/Salon|Business|Store|Barber/i.test(String(node?.['@type'] ?? ''))) continue;
      if (typeof node.name === 'string') out.name = node.name.trim();
      const ar = node.aggregateRating;
      if (ar) {
        if (typeof ar.ratingValue === 'number') out.rating = Math.round(ar.ratingValue * 10) / 10;
        if (typeof ar.reviewCount === 'number') out.reviewCount = ar.reviewCount;
      }
      const a = node.address ?? {};
      if (typeof a.addressLocality === 'string') out.town = a.addressLocality.trim();
      if (typeof a.streetAddress === 'string') out.street = a.streetAddress.trim();
      // AUTHOR NAMES ARE NOT READ. The array carries them; this does not. UK
      // GDPR, and CLAUDE.md section 5: themes, never individuals. Not redacted
      // downstream — never taken in the first place, so there is no copy to leak.
      for (const r of (Array.isArray(node.review) ? node.review : [])) {
        if (typeof r?.datePublished === 'string') {
          out.reviews.push({ on: r.datePublished.slice(0, 10), body: String(r?.reviewBody ?? '').trim() });
        }
      }
    }
  }
  return out;
}

/**
 * LIKE FOR LIKE, OR IT IS NOT A COMPARISON.
 *
 * The first version took the dearest single service and returned HINCES'
 * "Luxury Hot Towel Shave £50" as their headline — against the customer's
 * "Classic Cut £15". That reads as a 3x price gap and it is not one: it is a
 * cheap haircut measured against a premium shave. Their classic haircut is £35.
 *
 * A comparison has to name the same job on both menus. The customer's own
 * headline service is the anchor, and the competitor's closest match to it is
 * what gets compared. When nothing matches, the honest answer is null — no
 * comparable service — rather than the nearest number to hand.
 */
const STOP = new Set(['the', 'a', 'and', 'with', 'for', 'inc', 'including', 'our']);
const tokens = (s: string) =>
  new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)));

/** Cut and haircut are the same job under two names, and every barber uses both. */
const SAME_JOB: Record<string, string> = { haircut: 'cut', cuts: 'cut', hair: 'cut' };
const canon = (t: Set<string>) => new Set([...t].map(w => SAME_JOB[w] ?? w));

/**
 * Words every service in the trade contains, which therefore distinguish none
 * of them. Matching on these alone paired the customer's "Clipper Cut" with
 * HINCES' "Under 8's Haircut" — both contain "cut", and nothing else was
 * shared. A children's cut is not a clipper cut, and a confident wrong match is
 * worse than an honest blank, because the price gap it produces looks like a
 * finding.
 */
const GENERIC = new Set(['cut', 'service', 'appointment', 'session']);

/**
 * `core` is the trade's own job words, from discovery-routes. Without it "cut"
 * is a generic word that distinguishes nothing, and it has to be — otherwise a
 * clipper cut matches a child's cut. With it, "Classic Cut" and "Haircut" are
 * recognised as the same job, which they are for a barber and are not for a
 * florist. The word is only special when the trade says it is.
 */
export function comparableTo(ourService: string, theirs: VenueService[], core?: string[] | null): VenueService | null {
  const want = canon(tokens(ourService));
  if (!want.size) return null;
  const coreSet = new Set((core ?? []).map(w => w.toLowerCase()));
  const isCore = (n: string) => [...coreSet].some(w => n.toLowerCase().includes(w));
  const oursIsCore = isCore(ourService);
  // A COMBINED SERVICE LOSES TO A PLAIN ONE.
  //
  // "Hair & Beard £23" and "Adult Cut & Beard Trim £27" were matched to a plain
  // haircut while both menus also carried a plain cut. Two jobs sold together
  // cost more than one, so the comparison silently inflated the competitor and
  // made the customer look cheaper than they are — the exact direction of error
  // a price comparison must not make by accident.
  //
  // Excluding them outright was wrong too: "Beard & Moustache" is one job under
  // a two-word name, and on a menu with nothing plainer it is the right match.
  // So it is a ranking, not a filter: plain wins when a plain one exists.
  const combined = (name: string) => /\binc\b|\band\b|&/i.test(name);
  const ourCombined = combined(ourService);

  let best: { s: VenueService; distinctive: number; plain: number; total: number } | null = null;
  for (const s of theirs) {
    const shared = [...canon(tokens(s.name))].filter(w => want.has(w));
    let distinctive = shared.filter(w => !GENERIC.has(w)).length;
    // Both are the trade's core job, plainly named: that is a match even when
    // the only word they share is the generic one. "Classic Cut" and "Haircut"
    // are the same purchase at a barber.
    if (!distinctive && oursIsCore && isCore(s.name) && !combined(s.name) && shared.length) distinctive = 1;
    if (!distinctive) continue;            // a generic word alone is not a match
    // 1 when this candidate is the same shape as what we asked for.
    const plain = combined(s.name) === ourCombined ? 1 : 0;
    const better = !best
      || plain > best.plain
      || (plain === best.plain && distinctive > best.distinctive)
      || (plain === best.plain && distinctive === best.distinctive && shared.length > best.total);
    if (better) best = { s, distinctive, plain, total: shared.length };
  }
  return best ? best.s : null;
}

/** Kept for a venue seen on its own, with no customer service to anchor to. */
export function dearestSingle(services: VenueService[]): VenueService | null {
  const single = services.filter(s => !/&|and|inc\b/i.test(s.name));
  if (!single.length) return null;
  return single.reduce((a, b) => (b.high > a.high ? b : a));
}

/** Facts, each carrying where it came from. Nothing here is stated without one. */
export function claimsFrom(v: Venue, source: Source, anchor?: string): Claim[] {
  const out: Claim[] = [];
  if (v.reviewCount !== undefined) {
    out.push({ text: `${v.name ?? 'They'} have ${v.reviewCount.toLocaleString('en-GB')} reviews` +
                     (v.rating !== undefined ? ` at ${v.rating}` : ''), value: v.reviewCount, source });
  }
  const h = anchor ? comparableTo(anchor, v.services) : dearestSingle(v.services);
  if (h) {
    out.push({
      text: h.tiers > 1
        ? `${h.name} £${h.high}, their top of ${h.tiers} price tiers`
        : `${h.name} £${h.high}`,
      value: h.high, source,
    });
  }
  return out;
}
