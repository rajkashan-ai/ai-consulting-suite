/**
 * THE FIRST EVAL: the hand-built screen, as a target the pipeline must hit.
 *
 * Everything below was produced on 14 September 2026 by a person reading
 * booksy.com, fresha.com and six websites and typing the findings into
 * UI/workspace.html. No software produced any of it. That is exactly why it is
 * useful: it is an independent answer, arrived at by a different method, and
 * the dynamic pipeline has to reproduce it from the same starting URL.
 *
 * It is a target, not a truth. Where the pipeline disagrees, either it is wrong
 * or this record is — and finding out which is the point. When this record is
 * corrected, say why in the note beside the field.
 *
 * DERIVED, NOT RETYPED. The competitor rows were extracted from the rendered
 * table rather than copied by eye, so this file and the screen cannot disagree
 * about what the screen says. Regenerate with evals/extract-golden.ts.
 */
import type { Battlecard } from '../src/types.ts';

/** The only thing a run is given. Everything else must be worked out. */
export const INPUT = 'https://shrewsburybarber.co.uk/';

/** What step 2 must produce from that URL alone. Nothing downstream works
 *  without it: the search terms, the competitor set and the price comparison
 *  are all built from these six fields. */
export const EXPECTED_PROFILE = {
  name: 'The Barber Shop Shrewsbury',
  trade: 'barber',
  town: 'Shrewsbury',
  country: 'GB',
  services: ['Clipper cut', 'Classic cut', 'Beard trim', 'Cut & beard', 'Beard sculpting'],
  website: 'https://shrewsburybarber.co.uk/',
};

/** The five the tool picked, and the headline price it read for each.
 *  Prices are in pounds, read from Booksy on 14 September 2026. */
export const EXPECTED_COMPETITORS = [
  { name: 'HINCES',              headlinePrice: 35, service: 'Classic haircut',  source: 'booksy.com' },
  { name: 'The Fade Inn',        headlinePrice: 20, service: 'Skin fade / taper', source: 'booksy.com' },
  { name: 'NO.1 Barbers',        headlinePrice: 18, service: 'Haircut',          source: 'booksy.com' },
  { name: 'Barbering AJ',        headlinePrice: 17, service: 'Gents haircut',    source: 'booksy.com' },
  { name: 'Fish Street Barbers', headlinePrice: 25, service: 'Classic cut',      source: 'booksy.com' },
];

/** The customer's own prices, read from their own site, not a platform. */
export const EXPECTED_OWN_PRICES = {
  'Clipper cut': 8, 'Classic cut': 15, 'Beard trim': 8, 'Cut & beard': 20, 'Beard sculpting': 20,
};

/** The numbers the screen leads on. Each one is a claim the pipeline must be
 *  able to produce AND source, or not make at all. */
export const EXPECTED_HEADLINES = {
  reviewsAboutTheCustomer: 0,
  reviewsAcrossTheFive: 4799,
  /** Of three searches a customer would run, how many they appear in. */
  searchesAppearedIn: 2,
  searchesRun: 3,
  ownClassicCut: 15,
  medianClassicCutAcrossTheFive: 20,
};

/** Facts the run must reach, each with the source that proves it. These are the
 *  ones the three actions were built on, so a pipeline that misses them cannot
 *  produce the actions either. */
export const EXPECTED_FINDINGS = [
  { fact: 'all five competitors are listed on Booksy with a price and a review count', source: 'booksy.com' },
  { fact: 'the customer is on no booking platform with a rating or prices',            source: 'fresha.com' },
  { fact: 'the customer is the only one of the six publishing a full price menu',      source: 'six websites' },
  { fact: 'HINCES carries 2,461 reviews at 5.0',                                        source: 'booksy.com' },
  { fact: 'The Fade Inn has had no review for 41 days',                                 source: 'booksy.com' },
  { fact: '4 of 9 sampled reviews name an individual barber rather than the shop',      source: 'booksy.com' },
];

/** The three the tool chose, ranked. Judged, not equality-checked: a different
 *  wording that attacks the same weakness with the same evidence passes. */
export const EXPECTED_ACTIONS = [
  { rank: 1, area: 'channels', gist: 'get listed on Booksy, because all five are and the customer is not' },
  { rank: 2, area: 'reviews',  gist: 'ask every customer for a review by name, because the customer has none anywhere readable' },
  { rank: 3, area: 'pricing',  gist: 'surface the existing price menu where customers look before walking in' },
];

/** Things the run must NOT do, restated here so the eval carries them too. */
export const MUST_NOT = [
  'claim a traffic or visitor number for any of the six',
  'claim a Google ranking position',
  'name an individual reviewer',
  'state a count without saying where it stops',
  'carry more than five competitors, or other than three actions',
];

/** Filled once the pipeline runs. Null until then, and the gap is the point. */
export const ACTUAL: Battlecard | null = null;
