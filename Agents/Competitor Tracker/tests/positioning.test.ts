/**
 * The three things a snapshot cannot say, and the rules that keep them honest.
 * All three are judgement, which is why they carry harder rules than facts do.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePositioning, validatePrediction, sayPrediction,
  labelSelfClaim, usableAsEvidence, type Positioning, type Prediction,
} from '../src/positioning.ts';
import { shapeOf, nonConsumption } from '../src/competitor-set.ts';
import { findUnexplainedGaps } from '../src/guards.ts';

const SRC = { url: 'https://booksy.com/en-gb/12884_hinces', fetchedOn: '2026-09-14' };
const ev = (text: string) => ({ text, value: 1, source: SRC });
const NOW = new Date('2026-09-14T12:00:00.000Z');

/* ── 1. When you win ──────────────────────────────────────────────────────── */

const GOOD: Positioning = {
  win: 'Someone who already knows they want a beard trim and books that service',
  lose: 'Someone choosing a barber on reputation who has never been to any of you',
  evidence: [ev('You come up in 2 of 3 searches, and only for the service term')],
};

test('a condition naming a customer and a situation passes', () => {
  assert.deepEqual(validatePositioning(GOOD), []);
});

test('"we are better" is refused, because a rep could not use it', () => {
  const p = validatePositioning({ win: 'We are better than them', lose: 'They are better sometimes', evidence: [ev('x')] });
  assert.ok(p.some(x => x.kind === 'vague'));
});

/**
 * Battlecard research is explicit: a card claiming you win on every dimension
 * gets ignored, because the reader stops believing it.
 */
test('positioning with no losing case is refused outright', () => {
  assert.ok(validatePositioning({ ...GOOD, lose: '' }).some(x => x.kind === 'no-lose'));
});

test('positioning with nothing behind it is refused', () => {
  assert.ok(validatePositioning({ ...GOOD, evidence: [] }).some(x => x.kind === 'unsupported'));
});

/* ── 2. What they are likely to do next ───────────────────────────────────── */

const PRED: Prediction = {
  drives: ev('Every one of the five competes on reviews, all at 5.0'),
  believes: ev('None publishes a price menu, so none treats price as the battleground'),
  doing: ev('All five list on Booksy and take bookings there'),
  couldDo: ev('HINCES has 2,461 reviews and the staff to add more chairs'),
  expect: 'HINCES is more likely to open a second site than to cut its £35 price.',
  checkOn: '2026-12-14',
  wrongIf: 'their classic cut drops below £30 on Booksy',
};

test('a prediction resting on four sourced corners passes', () => {
  assert.deepEqual(validatePrediction(PRED, NOW), []);
});

test('a corner with no source sinks the prediction', () => {
  const bad = { ...PRED, believes: { text: 'They think price does not matter', value: 1, source: null } };
  assert.ok(validatePrediction(bad, NOW).some(x => x.kind === 'corner-unsourced'));
});

test('a prediction with no date to be judged on is just an opinion', () => {
  assert.ok(validatePrediction({ ...PRED, checkOn: '' }, NOW).some(x => x.kind === 'no-check-date'));
  assert.ok(validatePrediction({ ...PRED, checkOn: '2026-01-01' }, NOW).some(x => x.kind === 'no-check-date'));
});

test('a prediction nothing could disprove is refused', () => {
  assert.ok(validatePrediction({ ...PRED, wrongIf: '' }, NOW).some(x => x.kind === 'not-falsifiable'));
});

test('"they will raise prices" is refused: that is a guess worded as a fact', () => {
  const p = validatePrediction({ ...PRED, expect: 'They will raise prices in the new year.' }, NOW);
  assert.ok(p.some(x => x.kind === 'stated-as-fact'));
});

test('on screen it admits what it is, and when it can be checked', () => {
  const s = sayPrediction(PRED);
  assert.match(s, /^Our read, not a fact:/);
  assert.match(s, /We will know by 2026-12-14/);
  assert.match(s, /It is wrong if/);
});

/* ── 3. What the owner believes ───────────────────────────────────────────── */

test('an unchecked claim says so, and is not a bare gap', () => {
  const c = labelSelfClaim({ says: 'We are the cheapest in town', checkedAgainst: null, holdsUp: null });
  assert.equal(c.value, null);
  assert.match(c.text, /have not checked/);
  assert.deepEqual(findUnexplainedGaps([{ name: 'x', addedByCustomer: false, claims: { pricing: [c] } }]), []);
});

test('a claim the evidence contradicts says that plainly', () => {
  const c = labelSelfClaim({ says: 'We are the cheapest in town', checkedAgainst: SRC, holdsUp: false });
  assert.equal(c.value, 'contradicted');
  assert.match(c.text, /does not support it/);
});

/**
 * More than 85 per cent of people rate themselves less biased than average, and
 * in competitor work that becomes a steady over-reading of your own position.
 */
test('an unchecked self-claim can never become evidence for an action', () => {
  assert.equal(usableAsEvidence({ says: 'We are the friendliest', checkedAgainst: null, holdsUp: null }), false);
  assert.equal(usableAsEvidence({ says: 'We publish a full menu', checkedAgainst: SRC, holdsUp: true }), true);
  assert.equal(usableAsEvidence({ says: 'We are cheapest', checkedAgainst: SRC, holdsUp: false }), false);
});

/* ── 4. Substitutes: the most frequent mistake in competitor analysis ─────── */

/**
 * The tool walked into this on its first run. A search turned up two mobile
 * barbers and it filed them as ordinary competitors. A barber who comes to your
 * house is a different answer to the same question, and you cannot respond to
 * it by matching a price.
 */
test('a mobile barber is a substitute, not the same shape of business', () => {
  for (const [n, e] of [['Mobile Barber Shropshire', 'Home Haircuts'], ['Bridgette The Mobile Barber', 'comes to the customer']]) {
    assert.equal(shapeOf(n, e).shape, 'substitute', n);
  }
});

test('a chain competes on consistency, and is named as such', () => {
  const s = shapeOf('Headcase Barbers', 'nationwide chain, Shrewsbury branch');
  assert.equal(s.shape, 'substitute');
  assert.match(s.because, /consistency/);
});

test('a shop on a street is the same shape', () => {
  assert.equal(shapeOf('HINCES', 'Unit 3, Anchorage Avenue, Shrewsbury').shape, 'same');
});

test('every shape says why, so the owner can disagree with it', () => {
  for (const n of ['Mobile Barber Shropshire', 'HINCES', 'Headcase Barbers']) {
    assert.ok(shapeOf(n, '').because.length > 20, n);
  }
});

/**
 * A barber does not lose most of its potential customers to another barber. It
 * loses them to clippers. Nothing finds this by searching, so it is stated from
 * the trade and labelled as our read.
 */
test('the competitor nobody lists is named from the trade', () => {
  const n = nonConsumption('barber');
  assert.ok(n);
  assert.equal(n!.shape, 'non-consumption');
  assert.match(n!.name, /Clippers/);
  assert.match(n!.because, /not something we found/);
});

test('an unknown trade gets nothing rather than an invention', () => {
  assert.equal(nonConsumption('artisanal yak grooming'), null);
});
