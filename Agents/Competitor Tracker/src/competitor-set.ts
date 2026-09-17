/**
 * Who is on the list, and how it changes. CLAUDE.md section 2a.
 *
 * Five, never six, because six is a cost we did not price. Anyone the customer
 * named stays for ever. Nobody is ever evicted without being asked.
 */
import type { Competitor } from './types.ts';
import { sameBusiness, checkName } from './normalise.ts';

export const MAX_COMPETITORS = 5;

export type AddResult =
  | { status: 'added'; set: Competitor[] }
  | { status: 'needs-swap'; candidate: string; replaceOneOf: string[] }
  | { status: 'rejected'; reason: 'already-listed' | 'is-the-customer' | 'empty' | 'too-long' };

/**
 * Add a competitor the customer named.
 *
 * At five we ask which one it replaces. We never silently evict, and we never
 * grow past five.
 */
export function addCompetitor(set: Competitor[], raw: string, ownBusiness: string): AddResult {
  const checked = checkName(raw);
  if (!checked.ok) return { status: 'rejected', reason: checked.problem === 'empty' ? 'empty' : 'too-long' };
  const name = checked.name;

  if (sameBusiness(name, ownBusiness)) return { status: 'rejected', reason: 'is-the-customer' };
  if (set.some(c => sameBusiness(c.name, name))) return { status: 'rejected', reason: 'already-listed' };

  if (set.length >= MAX_COMPETITORS) {
    return { status: 'needs-swap', candidate: name, replaceOneOf: set.map(c => c.name) };
  }
  return { status: 'added', set: [...set, { name, addedByCustomer: true, claims: {} }] };
}

/** The customer answered the swap question. Exactly one leaves, the new one joins. */
export function replaceCompetitor(set: Competitor[], leaving: string, arriving: string): Competitor[] {
  const index = set.findIndex(c => sameBusiness(c.name, leaving));
  if (index === -1) throw new Error(`not on the list: ${leaving}`);
  const next = [...set];
  next.splice(index, 1, { name: arriving, addedByCustomer: true, claims: {} });
  return next;
}

/**
 * The weekly run found a fresh set of candidates.
 *
 * Everyone the customer named survives, whether or not fresh research would
 * have picked them. Our own picks are replaceable. The list never exceeds five,
 * and if the customer has named five, fresh research adds nobody.
 */
export function refreshSet(previous: Competitor[], freshlyFound: string[], ownBusiness: string): Competitor[] {
  const kept = previous.filter(c => c.addedByCustomer);
  const room = MAX_COMPETITORS - kept.length;
  if (room <= 0) return kept.slice(0, MAX_COMPETITORS);

  const additions: Competitor[] = [];
  for (const name of freshlyFound) {
    if (additions.length >= room) break;
    if (sameBusiness(name, ownBusiness)) continue;
    if (kept.some(c => sameBusiness(c.name, name))) continue;
    if (additions.some(c => sameBusiness(c.name, name))) continue;
    additions.push({ name, addedByCustomer: false, claims: {} });
  }
  return [...kept, ...additions];
}

/* ── What shape of competitor is this? ────────────────────────────────────── */

/**
 * The most frequent mistake in competitor analysis is looking only at direct
 * competitors and ignoring substitutes: the question is not "who else sells
 * what we sell" but "what is the customer trying to get done, and how else
 * could they get it done".
 *
 * Our own first run walked straight into it. A search turned up Mobile Barber
 * Shropshire and Bridgette The Mobile Barber and the tool filed them as
 * ordinary competitors. They are not. A barber who comes to your house is a
 * different answer to the same question, and the owner cannot respond to it by
 * matching a price.
 */
export type Shape =
  /** Same job, same shape. A shop you walk into. */
  | 'same'
  /** Same job, different shape. Mobile, at home, a chain, an app. */
  | 'substitute'
  /** The job done without paying anyone: clippers, a friend, leaving it. */
  | 'non-consumption';

export interface Shaped extends Competitor {
  shape: Shape;
  /** Why it was put in that bucket, so the customer can disagree. */
  because: string;
}

const SUBSTITUTE_SIGNS = [
  [/\bmobile\b|comes to you|at home|home visit|house call/i, 'comes to the customer instead of the customer coming to them'],
  [/\bapp\b|subscription|online only/i, 'sells the same job through a different channel'],
  [/\bchain\b|nationwide|franchise/i, 'a chain, so it competes on consistency rather than on a relationship'],
] as const;

/**
 * Worked out from the name, the website and what they say, then shown so the
 * owner can correct it. Never decided silently.
 */
export function shapeOf(name: string, evidence: string): { shape: Shape; because: string } {
  const hay = `${name} ${evidence}`;
  for (const [re, why] of SUBSTITUTE_SIGNS) {
    if (re.test(hay)) return { shape: 'substitute', because: why };
  }
  return { shape: 'same', because: 'the same kind of business, in the same place, doing the same job' };
}

/**
 * The one nobody lists, and for a small business often the biggest.
 *
 * A barber does not lose most of its potential customers to another barber. It
 * loses them to a £20 set of clippers and a patient partner. This is never
 * found by searching, so it is stated from the trade rather than discovered,
 * and it is labelled as our read.
 */
export function nonConsumption(trade: string): { shape: Shape; name: string; because: string } | null {
  const KNOWN: Record<string, string> = {
    barber: 'Clippers at home, or a friend with a set',
    hairdresser: 'Home colour kits and a friend',
    cleaner: 'Doing it themselves at the weekend',
    gardener: 'Doing it themselves, or letting it go',
    plumber: 'A YouTube video and a wrench',
    accountant: 'Filing it themselves with the free tools',
  };
  const key = trade.toLowerCase().trim();
  const name = KNOWN[key];
  if (!name) return null;
  return {
    shape: 'non-consumption',
    name,
    because: 'the same job done without paying anyone. Our read from the trade, not something we found',
  };
}
