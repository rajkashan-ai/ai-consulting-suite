/**
 * Every shape of hole, and that nothing treats one as a zero.
 *
 * A business that has told us almost nothing is the normal case, not the edge
 * case, and it is the one where a writing tool is most tempted to fill in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { KnownFacts } from '../src/types.ts';
import { isWritten } from '../src/types.ts';
import { checkShot, findInventedClaims, listGaps, validatePlan } from '../src/guards.ts';
import { validateShape } from '../src/plan-shape.ts';
import { describeRewrite } from '../src/voice.ts';
import { BARBER, PLAN, exportPlan, planWith } from './fixtures/businesses.ts';

const NOTHING: KnownFacts = {
  services: [], prices: {}, accreditations: [], awards: [],
  namedClients: [], counts: {}, reviewThemes: [], servesAnArea: true,
};

test('a business that has told us nothing gets no claims written for it', () => {
  // Every price in the clean plan is now unsourced, because we know no prices.
  const report = validatePlan(PLAN, NOTHING, exportPlan(PLAN));
  assert.ok(report.perPost.some(p => p.invented.some(c => c.kind === 'price')));
});

test('an undefined years figure is not the same as nought years', () => {
  assert.equal(BARBER.yearsTrading, undefined);
  assert.ok(findInventedClaims('We have been going 0 years.', BARBER).some(c => c.kind === 'years'));
  assert.deepEqual(findInventedClaims('We have been going 0 years.', { ...BARBER, yearsTrading: 0 }), []);
});

test('an empty count is not a zero count', () => {
  assert.ok(findInventedClaims('We have done 0 jobs like it this week.', BARBER).some(c => c.kind === 'count'));
});

test('where a post needs a real example it leaves a gap rather than inventing one', () => {
  const gaps = listGaps(PLAN);
  assert.ok(gaps.length >= 3, 'a plan for a business that told us almost nothing has no gaps in it');
  for (const g of gaps) assert.ok(g.asks.split(/\s+/).length >= 3, g.asks);
});

test('a missing shot is a problem, not an empty string on the page', () => {
  assert.deepEqual(checkShot({ ...PLAN.posts[0], shot: '   ' }), [{ kind: 'missing' }]);
});

test('a critique on a post that is not in the plan changes nothing', () => {
  const d = describeRewrite(PLAN, { kind: 'too-long', postDate: '2027-01-01' });
  assert.equal(d.willRewrite, 0);
  assert.match(d.sentence, /nothing left to rewrite/);
});

test('a plan with no posts at all does not throw', () => {
  const empty = { ...PLAN, posts: [] };
  assert.doesNotThrow(() => validatePlan(empty, BARBER, exportPlan(empty)));
});

test('isWritten is what decides whether a slot gets graded as prose', () => {
  // It sat in types.ts unused until 15 September while validateWeeks carried a
  // copy of the same check inline. Found by the Competitor Tracker's audit.
  assert.equal(isWritten(PLAN.posts[0]), true);
  assert.equal(isWritten({ ...PLAN.posts[0], words: '' }), false);
  assert.equal(isWritten({ ...PLAN.posts[0], words: '   ' }), false);
  assert.equal(isWritten({ ...PLAN.posts[0], words: undefined }), false);
});

test('an unwritten slot is not reported as a short post', () => {
  // Rewritten 15 September, when the words started arriving a week at a time.
  // This used to assert that empty words are "too short", which was right when
  // every post was written at once and is wrong now: an unwritten slot has no
  // words by design, and reporting it as a writing defect is a bug about our
  // own schedule wearing the costume of a bug in the prose.
  const bad = planWith([{ words: '' }]);
  const report = validatePlan(bad, BARBER, exportPlan(bad));
  assert.equal(report.perPost.length, bad.posts.length - 1, 'the unwritten slot was graded as prose');
});

test('but a post with no words inside a WRITTEN week is still caught', () => {
  // The protection the test above used to give, at the level that now owns it.
  const posts = PLAN.posts.map((p, i) => ({ ...p, week: 1, words: i === 0 ? '' : p.words }));
  const problems = validateShape({ ...PLAN, weeksWritten: 1, posts });
  assert.ok(problems.some(p => p.kind === 'no-words-in-a-written-week'));
});
