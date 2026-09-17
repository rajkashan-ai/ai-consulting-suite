/** The never-do list, CLAUDE.md section 6, one test each. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBuildDetail, findFeedbackPrompts, findInventedClaims, validatePlan } from '../src/guards.ts';
import { validateShape } from '../src/plan-shape.ts';
import { findOverwrites } from '../src/voice.ts';
import { BARBER, PLAN, exportPlan, planWith } from './fixtures/businesses.ts';

test('6.1 never invent anything about the business', () => {
  const bad = planWith([{ words: '15 years, 3,000 customers and a five-star rating. We are Gas Safe registered.' }]);
  const report = validatePlan(bad, BARBER, exportPlan(bad));
  assert.ok(report.perPost[0].invented.length >= 4, JSON.stringify(report.perPost[0].invented));
});

test('6.2 never put a feedback prompt inside the plan', () => {
  assert.deepEqual(findFeedbackPrompts(exportPlan(PLAN)), []);
  // Was ">= 2", which counted rather than tested. Bare 'feedback' has since
  // gone: "your feedback is what tells us what to do more of" is a barber
  // asking his own customers, and this rule is about our furniture leaking.
  assert.ok(findFeedbackPrompts('Was this helpful? Rate this plan.').length >= 2);
  assert.deepEqual(findFeedbackPrompts('Your feedback is what tells us what to do more of.'), []);
  // The critique labels are app furniture. If one reaches an export, the owner
  // pastes "Too salesy" into Facebook.
  assert.ok(findFeedbackPrompts('### 2026-09-18\nToo salesy').includes('too salesy'));
});

test('6.3 never assume they are local', () => {
  // This used to assert only that the CLEAN plan carries no local words, which
  // is true whether or not the rule works: gutting findLocalAssumptions to
  // `return []` left the file green. Found on 14 September by an independent
  // pass. It now puts a local claim in front of a national seller, which is the
  // case the rule exists for.
  const national = { ...BARBER, servesAnArea: false };
  const bad = planWith([{ words: 'Your local studio, right on your doorstep and near you.' }]);
  assert.ok(validatePlan(bad, national, exportPlan(bad)).perPost[0].local.length >= 3);
  assert.deepEqual(validatePlan(bad, BARBER, exportPlan(bad)).perPost[0].local, [],
    'local wording was stripped from a business that does serve an area');
  assert.ok(validatePlan(PLAN, national, exportPlan(PLAN)).perPost.every(p => p.local.length === 0),
    'the clean plan says local somewhere');
});

test('6.4 never write a post that needs a photo they cannot take', () => {
  const bad = planWith([{ shot: 'Get a videographer in for a time-lapse of the whole day.' }]);
  assert.ok(validatePlan(bad, BARBER, exportPlan(bad)).perPost[0].shot.length >= 2);
});

test('6.5 never produce more than their cadence answer asked for', () => {
  const weekly = { ...PLAN, cadence: 'weekly' as const };
  assert.ok(validateShape(weekly).some(p => p.kind === 'wrong-count' && p.want === 4 && p.got === 9));
});

test('6.6 never overwrite a post the owner has edited or approved', () => {
  const before = planWith([{ editedByOwner: true }, { approved: true }]);
  const after = planWith([
    { editedByOwner: true, words: 'ours' },
    { approved: true, words: 'ours' },
  ]);
  assert.equal(findOverwrites(before, after).length, 2);
});

test('6.7 never date a post in the past', () => {
  const bad = planWith([{ date: '2026-09-13' }]);
  assert.ok(validateShape(bad).some(p => p.kind === 'date-in-the-past'));
});

test('6.8 never research a competitor here', () => {
  // The rule is a scope rule, so what it leaves behind in the output is a named
  // business we have no source for. That is the same shape as an invented client.
  const bad = 'Kemp Barbers Ltd charge £25 and have no price list up.';
  assert.ok(findInventedClaims(bad, BARBER).some(c => c.kind === 'named-client'));
});

test('no build detail reaches a customer', () => {
  assert.deepEqual(findBuildDetail(exportPlan(PLAN)), []);
  assert.ok(findBuildDetail('We will regenerate the rest of the pipeline.').length >= 2);
});
