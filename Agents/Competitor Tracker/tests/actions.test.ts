/**
 * The three actions. CLAUDE.md section 3a.
 * Three, ranked, each evidence-backed, each naming the weakness it attacks.
 * Three cannot cover four areas and are not meant to.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateActions, areasCovered } from '../src/guards.ts';
import { said, couldNotSee } from './fixtures/companies.ts';
import type { Action } from '../src/types.ts';

const BOOKSY = 'https://booksy.com/en-gb/hinces';

/** The three that shipped on 14 September, as the workspace mockup shows them. */
const SHIPPED: Action[] = [
  { rank: 1, area: 'channels', headline: 'Get listed on Booksy',
    why: 'Every one of the five is on it with their prices and reviews showing. You are not.',
    evidence: [said('5 of 5 competitors listed on Booksy with a price and a review count', 5, BOOKSY)] },
  { rank: 2, area: 'reviews', headline: 'Ask every customer for a review, starting this week',
    why: 'There are 4,799 reviews across the five of them and none about you.',
    evidence: [said('4,799 reviews across the five', 4799, BOOKSY),
               said('You: none found on any platform we could reach', 0, 'https://shrewsburybarber.co.uk')] },
  { rank: 3, area: 'pricing', headline: 'Put your price list where people look before they walk in',
    why: 'You are the only one of the six publishing a full menu. The page exists. Nothing points at it.',
    evidence: [said('You publish 5 priced services', 5, 'https://shrewsburybarber.co.uk/prices'),
               said('All five show one headline price, on Booksy only', 1, BOOKSY)] },
];

test('the three that shipped pass every rule', () => {
  assert.deepEqual(validateActions(SHIPPED), []);
});

test('exactly three, never two', () => {
  const p = validateActions(SHIPPED.slice(0, 2));
  assert.ok(p.some(x => x.kind === 'wrong-count'));
});

test('and never four, however good the fourth is', () => {
  const four = [...SHIPPED, { ...SHIPPED[0], rank: 4, area: 'blindspots' as const, headline: 'A fourth' }];
  assert.ok(validateActions(four).some(x => x.kind === 'wrong-count'));
});

test('ranks are 1, 2 and 3, so the customer is not left to prioritise', () => {
  const tied = SHIPPED.map(a => ({ ...a, rank: 1 }));
  assert.ok(validateActions(tied).some(x => x.kind === 'ranks-not-1-2-3'));
});

test('every action names the weakness it attacks', () => {
  const untagged = [{ ...SHIPPED[0], area: undefined as never }, SHIPPED[1], SHIPPED[2]];
  assert.ok(validateActions(untagged).some(x => x.kind === 'no-area'));
});

test('an action with no evidence does not ship', () => {
  const empty = [{ ...SHIPPED[0], evidence: [] }, SHIPPED[1], SHIPPED[2]];
  assert.ok(validateActions(empty).some(x => x.kind === 'no-evidence'));
});

test('evidence without a source does not count as evidence', () => {
  const unsourced = [{ ...SHIPPED[0], evidence: [{ text: 'Everyone is on Booksy', value: 5, source: null }] }, SHIPPED[1], SHIPPED[2]];
  assert.ok(validateActions(unsourced).some(x => x.kind === 'unsourced-evidence'));
});

/**
 * 14 September. The Fade Inn's 9,065 followers against HINCES's 2,537 is the
 * biggest number in the set, and it nearly became action three. The customer's
 * own follower count was never counted, so there was no gap to point at. A
 * hypothesis resting on a field we did not read is not evidence-backed.
 */
test('an action resting on a field we never read is rejected', () => {
  const instagram: Action = {
    rank: 3, area: 'channels', headline: 'Win attention on Instagram',
    why: 'The Fade Inn has 9,065 followers on a £20 cut. HINCES has 2,537 on a £35 cut.',
    evidence: [
      said('The Fade Inn: 9,065 Instagram followers', 9065, 'https://instagram.com/thefadeinn'),
      couldNotSee('Your own follower count was not counted'),
    ],
  };
  const problems = validateActions([SHIPPED[0], SHIPPED[1], instagram]);
  assert.ok(problems.some(x => x.kind === 'rests-on-a-hole'), 'the Instagram action should be refused');
});

test('two actions may share an area: coverage is never forced', () => {
  const twoChannels = [SHIPPED[0], { ...SHIPPED[1], area: 'channels' as const }, SHIPPED[2]];
  assert.deepEqual(validateActions(twoChannels), []);
});

test('the uncovered areas are reported, not hidden', () => {
  const { covered, uncovered } = areasCovered(SHIPPED);
  assert.deepEqual(covered.sort(), ['channels', 'pricing', 'reviews']);
  assert.deepEqual(uncovered, ['blindspots']);
});

test('an area with nothing in it produces no action, and that is correct', () => {
  // Booksy shows one headline service per shop, so blindspots was genuinely thin.
  assert.ok(!SHIPPED.some(a => a.area === 'blindspots'));
  assert.deepEqual(validateActions(SHIPPED), []);
});

/* ── The one output that could genuinely damage a business ─────────────────── */

const RAISE_PRICES: Action = {
  rank: 3, area: 'pricing', headline: 'Raise your classic cut to £20',
  why: 'Your classic cut is £15 against a median of £20 across the five, and HINCES charges £35.',
  evidence: [said('Median classic cut across the five: £20', 20, BOOKSY)],
};

test('a price rise is refused when we do not know what the work costs them', () => {
  const problems = validateActions([SHIPPED[0], SHIPPED[1], RAISE_PRICES], { knownCosts: false });
  assert.ok(problems.some(x => x.kind === 'prices-without-costs'));
});

test('and allowed once they have told us', () => {
  const problems = validateActions([SHIPPED[0], SHIPPED[1], RAISE_PRICES], { knownCosts: true });
  assert.deepEqual(problems, []);
});

test('the deferral wording used on the real card is not a price recommendation', () => {
  // "Worth testing, not doing yet" sits inside the evidence, so it must pass.
  assert.deepEqual(validateActions(SHIPPED, { knownCosts: false }), []);
});
