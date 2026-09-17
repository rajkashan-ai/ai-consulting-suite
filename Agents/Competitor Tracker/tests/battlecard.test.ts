/**
 * validateBattlecard behaving: the gate everything leaves through.
 *
 * Whether each guard is *plugged into* it, and whether each has a test of its
 * own, are separate claims and they live in wiring.test.ts. This file assumes
 * the wiring and checks what the gate actually reports.
 *
 * Until 15 September none of this existed. The gate appeared exactly once in
 * the whole repo, its own definition: never called in src, never referenced by
 * a doc, never tested. So nothing compared the guards that exist against the
 * guards that run, and findRankClaims sat unwired behind five passing tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBattlecard } from '../src/guards.ts';
import { RICH, PLATFORM_ONLY, REAL_FIVE, said, OWN_BUSINESS } from './fixtures/companies.ts';
import type { Action, Battlecard } from '../src/types.ts';

const BOOKSY = 'https://booksy.com/en-gb/hinces';
const NOW = new Date('2026-09-14T08:02:00Z');

const ACTIONS: Action[] = [
  { rank: 1, area: 'channels', headline: 'Get listed on Booksy',
    why: 'Every one of the five is on it with their prices and reviews showing. You are not.',
    evidence: [said('5 of 5 competitors listed on Booksy with a price and a review count', 5, BOOKSY)] },
  { rank: 2, area: 'reviews', headline: 'Ask every customer for a review, starting this week',
    why: 'There are 4,799 reviews across the five of them and none about you.',
    evidence: [said('4,799 reviews across the five', 4799, BOOKSY)] },
  { rank: 3, area: 'pricing', headline: 'Put your price list where people look before they walk in',
    why: 'You are the only one of the six publishing a full menu. Nothing points at it.',
    evidence: [said('You publish 5 priced services', 5, 'https://shrewsburybarber.co.uk/prices')] },
];

const CLEAN: Battlecard = {
  business: OWN_BUSINESS,
  ranAt: '2026-09-14T08:02:00Z',
  competitors: REAL_FIVE,
  actions: ACTIONS,
  sources: [{ url: BOOKSY, fetchedOn: '2026-09-14' }],
  unreadable: [],
};

const PROSE = 'Five barbers within a mile. HINCES has 2,461 reviews at 5.0. You have none.';

/* ── The gate reports every guard it runs ─────────────────────────────────── */

test('the gate returns a result for every guard, not just a call', () => {
  // A guard could be called and its result thrown away. Every key must arrive.
  const out = validateBattlecard(CLEAN, PROSE, NOW);
  for (const key of ['traffic', 'rankClaims', 'feedback', 'unsourced', 'impossibleDates',
                     'stale', 'namedReviewers', 'unexplainedGaps', 'buildDetail',
                     'actions', 'tooManyCompetitors']) {
    assert.ok(key in out, `validateBattlecard drops ${key} from its result`);
  }
});

/* ── The gate, behaving ───────────────────────────────────────────────────── */

test('a clean card raises nothing', () => {
  const out = validateBattlecard(CLEAN, PROSE, NOW);
  assert.deepEqual(out.traffic, []);
  assert.equal(out.rankClaims, false);
  assert.deepEqual(out.feedback, []);
  assert.deepEqual(out.namedReviewers, []);
  assert.deepEqual(out.buildDetail, []);
  assert.deepEqual(out.actions, []);
  assert.equal(out.tooManyCompetitors, false);
});

test('a rank claim in the export is caught, which it was not before today', () => {
  const out = validateBattlecard(CLEAN, 'You rank third on Google for best barber Shrewsbury.', NOW);
  assert.equal(out.rankClaims, true, 'the rank guard is not running on the export');
});

test('a traffic claim is caught', () => {
  const out = validateBattlecard(CLEAN, 'HINCES gets around 40,000 visitors per month.', NOW);
  assert.ok(out.traffic.length > 0);
});

test('a named reviewer is caught, whatever the case', () => {
  const out = validateBattlecard(CLEAN, 'Reviewer Sarah says the fade is the best in town.', NOW);
  assert.ok(out.namedReviewers.length > 0, 'a named individual reached the export');
});

test('build detail on a customer screen is caught', () => {
  const out = validateBattlecard(CLEAN, 'That is being started: identity check, passport, proof of address.', NOW);
  assert.ok(out.buildDetail.length > 0);
});

test('a sixth competitor is caught', () => {
  const six = { ...CLEAN, competitors: [...REAL_FIVE, { ...RICH, name: 'A sixth' }] };
  assert.equal(validateBattlecard(six, PROSE, NOW).tooManyCompetitors, true);
});

test('five is the cap, not a warning', () => {
  assert.equal(validateBattlecard(CLEAN, PROSE, NOW).tooManyCompetitors, false);
  assert.equal(CLEAN.competitors.length, 5);
});

test('bad actions surface through the gate, not just through validateActions', () => {
  const two = { ...CLEAN, actions: ACTIONS.slice(0, 2) };
  assert.ok(validateBattlecard(two, PROSE, NOW).actions.some(p => p.kind === 'wrong-count'));
});

test('an unsourced claim surfaces through the gate', () => {
  const bad = {
    ...CLEAN,
    competitors: [{ ...PLATFORM_ONLY, claims: { pricing: [{ text: 'Classic cut £22', value: 22, source: null }] } }],
  };
  assert.ok(validateBattlecard(bad, PROSE, NOW).unsourced.length > 0);
});

test('knownCosts is passed through to the action rules, not swallowed', () => {
  const priceMove: Action[] = [
    { ...ACTIONS[0], rank: 1, area: 'pricing', headline: 'Raise your classic cut to £20',
      why: 'The median across the five is £20 and you are at £15.',
      evidence: [said('Median classic cut across the five is £20', 20, BOOKSY)] },
    ACTIONS[1], ACTIONS[2],
  ];
  const card = { ...CLEAN, actions: priceMove };
  const guessing = validateBattlecard(card, PROSE, NOW, false);
  const knowing = validateBattlecard(card, PROSE, NOW, true);
  assert.notDeepEqual(guessing.actions, knowing.actions,
    'knownCosts changes nothing, so the flag is not reaching validateActions');
});
