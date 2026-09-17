/**
 * A competitor's platform page, turned into facts.
 *
 * The fixture is the real schema.org and service JSON from the HINCES Booksy
 * page, fetched 15 September 2026. Not invented, and not the parsed answer
 * written back as a fixture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { venueFrom, comparableTo, dearestSingle, claimsFrom } from '../src/venue.ts';
import { findNamedReviewers } from '../src/guards.ts';

const html = readFileSync(join(import.meta.dirname, 'fixtures', 'booksy-venue.html'), 'utf8');
const v = venueFrom(html);

test('the review count and rating come off the page, not an estimate', () => {
  assert.equal(v.reviewCount, 2461);   // the hand-built screen says 2,461
  assert.equal(v.rating, 5);
});

test('reviewer names are never taken in the first place', () => {
  // The platform publishes author names in the same block. Not redacted after
  // the fact — never read, so there is no copy of them to leak. UK GDPR.
  assert.ok(v.reviews.length > 0, 'no reviews parsed, so this proves nothing');
  const asText = JSON.stringify(v.reviews);
  assert.doesNotMatch(asText, /author|"name"/i);
  assert.deepEqual(findNamedReviewers(asText), []);
});

test('review dates survive, because "still trading" depends on them', () => {
  for (const r of v.reviews) assert.match(r.on, /^\d{4}-\d{2}-\d{2}$/);
});

test('a service with several tiers keeps both ends and the count', () => {
  // HINCES lists Classic Haircut at five prices, one per stylist tier. A single
  // number with a hidden range behind it is the same defect as a count with no
  // boundary.
  const classic = v.services.find(s => /classic haircut$/i.test(s.name));
  assert.ok(classic, 'Classic Haircut not parsed');
  assert.equal(classic!.high, 35);
  assert.ok(classic!.tiers > 1, 'the tiers were flattened to one');
  assert.ok(classic!.low < classic!.high);
});

test('the comparison is like for like, not cheapest against dearest', () => {
  // The first version returned "Luxury Hot Towel Shave £50" as the headline,
  // against the customer's "Classic Cut £15". A cheap haircut measured against
  // a premium shave reads as a 3x gap and is not one.
  assert.equal(comparableTo('Classic Cut', v.services)?.name, 'Classic Haircut');
  assert.equal(comparableTo('Classic Cut', v.services)?.high, 35);
});

test('a generic word alone is not a match', () => {
  // "Clipper Cut" matched "Under 8's Haircut" on the word "cut". A children's
  // cut is not a clipper cut, and a confident wrong match produces a price gap
  // that looks like a finding.
  assert.equal(comparableTo('Clipper Cut', v.services), null);
});

test('and a real match on a distinctive word still works', () => {
  assert.equal(comparableTo('Beard Trim', v.services)?.name, 'Beard & Moustache');
});

test('with no anchor it falls back to the dearest single service, and says which', () => {
  assert.equal(dearestSingle(v.services)?.name, 'Luxury Hot Towel Shave');
});

test('every claim carries a source', () => {
  const claims = claimsFrom(v, { url: 'https://booksy.com/x', fetchedOn: '2026-09-15' }, 'Classic Cut');
  assert.ok(claims.length >= 2);
  for (const c of claims) assert.ok(c.source, `unsourced: ${c.text}`);
});

test('a price claim says the range it came from', () => {
  const claims = claimsFrom(v, { url: 'https://booksy.com/x', fetchedOn: '2026-09-15' }, 'Classic Cut');
  const price = claims.find(c => /£35/.test(c.text));
  assert.match(price!.text, /top of 5 price tiers/);
});
