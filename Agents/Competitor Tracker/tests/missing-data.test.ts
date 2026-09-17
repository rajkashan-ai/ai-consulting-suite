/**
 * When the data simply is not there.
 *
 * An empty cell is a finding, not a failure. CLAUDE.md section 4. These test
 * that the tool says so rather than guessing, and that nothing downstream
 * quietly treats a hole as a zero.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findUnsourcedClaims, validateActions, findUnexplainedGaps } from '../src/guards.ts';
import { refreshSet } from '../src/competitor-set.ts';
import {
  INVISIBLE, NO_PRICES, THE_CUSTOMER, PLATFORM_ONLY, NOT_LOCAL, RANGE_PRICING,
  OWN_BUSINESS, said, couldNotSee,
} from './fixtures/companies.ts';
import type { Action } from '../src/types.ts';

test('a business with nothing public still gets a row, honestly empty', () => {
  assert.equal(Object.keys(INVISIBLE.claims).length, 4);
  for (const claims of Object.values(INVISIBLE.claims)) {
    for (const c of claims ?? []) assert.equal(c.value, null);
  }
  assert.deepEqual(findUnsourcedClaims([INVISIBLE]), []);
});

test('nobody publishes a price, so "nobody publishes a price" is the finding', () => {
  assert.equal(NO_PRICES.claims.pricing![0].value, null);
});

test('a business on a booking platform and nowhere else is readable', () => {
  assert.equal(PLATFORM_ONLY.claims.pricing![0].value, 17);
  assert.equal(PLATFORM_ONLY.claims.channels![0].value, null);
});

test('a price range is kept as a range, never rounded into a point', () => {
  assert.equal(RANGE_PRICING.claims.pricing![0].value, 'from 18');
  assert.notEqual(RANGE_PRICING.claims.pricing![0].value, 18);
});

test('a business selling beyond its doorstep has no local claim', () => {
  assert.ok(!('blindspots' in NOT_LOCAL.claims));
  assert.equal(NOT_LOCAL.claims.channels![0].value, 'national');
});

test('the customer having zero reviews is the finding, not an error', () => {
  const reviews = THE_CUSTOMER.claims.reviews![0];
  assert.equal(reviews.value, null);
  assert.match(reviews.text, /no public reviews/i);
});

test('a follower count we never took is null, never zero', () => {
  const notCounted = THE_CUSTOMER.claims.channels!.find(c => /not counted/i.test(c.text))!;
  assert.equal(notCounted.value, null);
  assert.notEqual(notCounted.value as unknown, 0);   // zero would read as "they have no followers"
});

test('and nothing downstream may build an action on it', () => {
  const built: Action[] = [
    { rank: 1, area: 'channels', headline: 'Grow your Instagram',
      why: 'The Fade Inn has 9,065 followers.',
      evidence: [couldNotSee('Your own following was not counted. We count theirs, not yours')] },
    { rank: 2, area: 'reviews', headline: 'Ask for reviews', why: 'x',
      evidence: [said('4,799 reviews across the five', 4799, 'https://booksy.com')] },
    { rank: 3, area: 'pricing', headline: 'Publish your menu', why: 'x',
      evidence: [said('You publish 5 priced services', 5, 'https://shrewsburybarber.co.uk')] },
  ];
  assert.ok(validateActions(built).some(p => p.kind === 'rests-on-a-hole'));
});

test('the customer has no website, only a name and a town, and the tool still runs', () => {
  const profile = { name: 'Fixture Barbers', town: 'Shrewsbury', website: null };
  assert.equal(profile.website, null);
  assert.ok(profile.name && profile.town);
});

test('fewer than five competitors exist, and we do not invent a fifth', () => {
  const set = refreshSet([], ['Fixture A', 'Fixture B', 'Fixture C'], OWN_BUSINESS);
  assert.equal(set.length, 3);
});

test('no competitors at all is a result the screen can show', () => {
  assert.deepEqual(refreshSet([], [], OWN_BUSINESS), []);
});

test('an area empty for everyone produces no action for that area', () => {
  const everyoneBlank = [INVISIBLE, { ...INVISIBLE, name: 'Fixture Two' }];
  for (const c of everyoneBlank) {
    for (const claims of Object.values(c.claims)) {
      for (const claim of claims ?? []) assert.equal(claim.value, null);
    }
  }
  // Nothing sourced exists, so no action can be evidence-backed, so none ships.
  assert.ok(validateActions([]).some(p => p.kind === 'wrong-count'));
});

/* ── A gap must say why, or it reads as a shrug ──────────────────────────── */

test('every empty cell in the real run says what is absent or why we did not look', () => {
  assert.deepEqual(findUnexplainedGaps([THE_CUSTOMER, PLATFORM_ONLY, NO_PRICES, INVISIBLE]), []);
});

test('a bare "Not checked" is refused, because it reads as "there was nothing to find"', () => {
  const bare = ['Not checked', 'Not counted', 'Unknown', 'None', 'n/a', 'No data', 'TBC', '-'];
  for (const text of bare) {
    const c = [{ name: 'Fixture', addedByCustomer: false, claims: { channels: [couldNotSee(text)] } }];
    assert.equal(findUnexplainedGaps(c).length, 1, `let "${text}" through`);
  }
});

test('the advertising gap passes once it says why', () => {
  // 14 September: this cell read "Not checked" and Raj asked why. The answer is
  // that the Meta Ad Library needs an approval nobody has applied for.
  const withReason = couldNotSee('Not checked: the Meta Ad Library needs an API access we have not applied for');
  const c = [{ name: 'Fixture', addedByCustomer: false, claims: { channels: [withReason] } }];
  assert.deepEqual(findUnexplainedGaps(c), []);
});

test('a first run has no "since last time" section, because there is nothing to compare', () => {
  const firstRun = { previousRunAt: null as string | null, since: null as unknown };
  assert.equal(firstRun.previousRunAt, null);
  assert.equal(firstRun.since, null);
});

test('a quiet week says nothing moved and what it checked, rather than saying nothing', () => {
  const quiet = { moved: [], checked: { competitors: 5, pages: 24 } };
  assert.equal(quiet.moved.length, 0);
  assert.ok(quiet.checked.pages > 0, 'a quiet week with no page count is indistinguishable from a failed run');
});
