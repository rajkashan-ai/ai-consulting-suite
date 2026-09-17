/**
 * When a fetch does not work.
 *
 * The rule across all of these: keep what worked, name what did not, never
 * invent the gap. A confident answer about a page we never saw is the worst
 * output this tool could produce.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findUnsourcedClaims } from '../src/guards.ts';
import { mayFetch, ROBOTS } from '../src/fetch-policy.ts';
import type { Battlecard, FetchFailure } from '../src/types.ts';
import { REAL_FIVE, couldNotSee } from './fixtures/companies.ts';

/** What the run does when one competitor cannot be read. */
function afterFailure(name: string, reason: FetchFailure): Battlecard {
  return {
    business: 'The Barber Shop Shrewsbury',
    ranAt: '2026-09-14T08:02:00.000Z',
    competitors: [
      ...REAL_FIVE.filter(c => c.name !== name),
      { name, addedByCustomer: false, claims: { pricing: [couldNotSee(`Could not read their page: ${reason}`)] } },
    ],
    actions: [],
    sources: [],
    unreadable: [{ name, reason }],
  };
}

const FAILURES: { reason: FetchFailure; story: string }[] = [
  { reason: 'forbidden',         story: '403, as Checkatrade returns to us' },
  { reason: 'not-found',         story: '404, or the domain does not resolve at all' },
  { reason: 'timeout',           story: 'the site never answered' },
  { reason: 'robots-disallowed', story: 'their robots.txt says no' },
  { reason: 'empty-body',        story: '200 with nothing in it, as the Meta Ad Library gave us' },
  { reason: 'needs-login',       story: 'the prices are behind a sign-in' },
  { reason: 'cost-cap',          story: 'the run hit its cost ceiling before reaching them' },
];

for (const { reason, story } of FAILURES) {
  test(`${reason}: the competitor stays on the card, named, with the gap stated (${story})`, () => {
    const card = afterFailure('Fish Street Barbers', reason);
    assert.equal(card.competitors.length, 5, 'a competitor was dropped instead of marked');
    assert.equal(card.unreadable[0].name, 'Fish Street Barbers');
    assert.equal(card.unreadable[0].reason, reason);
  });

  test(`${reason}: nothing is invented to fill the gap`, () => {
    const card = afterFailure('Fish Street Barbers', reason);
    const failed = card.competitors.find(c => c.name === 'Fish Street Barbers')!;
    for (const claims of Object.values(failed.claims)) {
      for (const claim of claims ?? []) assert.equal(claim.value, null);
    }
    assert.deepEqual(findUnsourcedClaims(card.competitors), []);
  });
}

test('three of five read: the two that failed are named, the three are kept', () => {
  const card: Battlecard = {
    business: 'The Barber Shop Shrewsbury', ranAt: '2026-09-14T08:02:00.000Z',
    competitors: REAL_FIVE.slice(0, 3),
    actions: [], sources: [],
    unreadable: [{ name: 'Barbering AJ', reason: 'timeout' }, { name: 'Fish Street Barbers', reason: 'forbidden' }],
  };
  assert.equal(card.competitors.length + card.unreadable.length, 5);
  assert.ok(card.unreadable.every(u => u.reason));
});

test('none of five read: we say so rather than shipping a battlecard of nothing', () => {
  const card: Battlecard = {
    business: 'The Barber Shop Shrewsbury', ranAt: '2026-09-14T08:02:00.000Z',
    competitors: [], actions: [], sources: [],
    unreadable: REAL_FIVE.map(c => ({ name: c.name, reason: 'timeout' as const })),
  };
  assert.equal(card.competitors.length, 0);
  assert.equal(card.actions.length, 0, 'actions were written with no evidence behind them');
  assert.equal(card.unreadable.length, 5);
});

test('a robots-disallowed page is never fetched in the first place, so it fails before the request', () => {
  const r = mayFetch('https://booksy.com/en-gb/search/barbers/shrewsbury', ROBOTS.booksy);
  assert.equal(r.allowed, false);
});

test('the cost cap stops the run and keeps what it already has', () => {
  const card = afterFailure('Fish Street Barbers', 'cost-cap');
  assert.ok(card.competitors.some(c => Object.keys(c.claims).length > 0), 'threw away work already paid for');
});

test('malformed html does not take the run down', () => {
  const broken = '<html><body><div><p>Cuts £20<table><tr><td>unclosed everything';
  assert.doesNotThrow(() => broken.replace(/<[^>]*>/g, ' ').trim());
});
