/** Section 4: never put a claim in their mouth that they have not given us. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkLength, checkShot, findEmptyGaps, findInventedClaims, findLocalAssumptions,
  findRepeatedOpenings, findUnlistedGaps, listGaps, validatePlan, weeksCovered,
} from '../src/guards.ts';
import { BARBER, PLAN, STUDIO, exportPlan, planWith } from './fixtures/businesses.ts';

const kinds = (text: string, known = BARBER) => findInventedClaims(text, known).map(c => c.kind);

test('the clean plan invents nothing', () => {
  const report = validatePlan(PLAN, BARBER, exportPlan(PLAN));
  for (const p of report.perPost) {
    assert.deepEqual(p.invented, [], `${p.date} invented something`);
    assert.deepEqual(p.local, [], p.date);
    assert.deepEqual(p.shot, [], p.date);
    assert.deepEqual(p.length, [], p.date);
  }
  assert.deepEqual(report.repeatedOpenings, []);
  assert.deepEqual(report.emptyGaps, []);
  assert.deepEqual(report.unlistedGaps, []);
  assert.deepEqual(report.feedback, []);
  assert.deepEqual(report.buildDetail, []);
});

test('the draft\'s own example is caught', () => {
  // "How we solved a complex commercial heating failure for Acme Corp."
  assert.ok(kinds('How we solved a complex heating failure for Acme Ltd last month.').includes('named-client'));
  assert.ok(kinds('We worked with Harlow Tea on this one.').includes('named-client'));
});

test('a client they did give us is allowed', () => {
  assert.deepEqual(findInventedClaims('We worked with Harlow Tea on this one.', STUDIO), []);
});

test('years, counts, percentages and savings are all inventions unless given', () => {
  assert.ok(kinds('We have been doing this for 22 years.').includes('years'));
  assert.ok(kinds('Over 4,000 happy customers since we opened.').includes('count'));
  assert.ok(kinds('We cut our own no-show rate by 30%.').includes('percentage'));
  assert.ok(kinds('We saved him £400 on the job.').includes('saving'));
});

test('a number that belongs to their trade is not a claim about them', () => {
  // The Competitor Tracker learned this as "cut is a noun in a barber's shop".
  // Here it is "eight weeks" being about hair, not about how long they have traded.
  assert.deepEqual(kinds('The mistake is leaving it eight weeks between cuts.'), []);
  assert.deepEqual(kinds('A classic cut is shaped to grow out for about four weeks.'), []);
});

test('a number they did give us is allowed', () => {
  assert.deepEqual(findInventedClaims('We have been at it nine years now.', STUDIO), []);
  assert.deepEqual(findInventedClaims('We have 40 clients on the books.', STUDIO), []);
});

test('a price we never read is an invention, and the ones we read are not', () => {
  assert.ok(kinds('Beard trim, £12.').includes('price'));
  assert.deepEqual(kinds('Classic cut £15. Cut and beard £20.'), []);
});

test('credentials and awards are never assumed', () => {
  assert.ok(kinds('We are Gas Safe registered and fully insured.').includes('credential'));
  assert.ok(kinds('Voted best barber in town three years running.').includes('award'));
});

test('a review is never written for them', () => {
  assert.ok(kinds('One customer told us it was the best cut he had ever had.').includes('review-quote'));
  assert.ok(kinds('"Absolutely first class, would not go anywhere else."').includes('review-quote'));
});

test('local is fine for a barber and wrong for a studio', () => {
  assert.deepEqual(findLocalAssumptions('Your local barber, six days a week.', BARBER), []);
  assert.ok(findLocalAssumptions('Your local studio, on your doorstep.', STUDIO).length >= 2);
});

test('a shot they cannot take is caught', () => {
  const bad = { ...PLAN.posts[0], shot: 'Hire a professional photographer for a studio shot.' };
  const problems = checkShot(bad).filter(p => p.kind === 'needs').map(p => (p as { what: string }).what);
  assert.ok(problems.includes('professional photographer'));
  assert.ok(problems.includes('studio'));
  assert.deepEqual(checkShot({ ...PLAN.posts[0], shot: '' }), [{ kind: 'missing' }]);
});

test('each post is written for its channel and not pasted across three', () => {
  const short = { ...PLAN.posts[0], words: 'New in today.' };
  assert.ok(checkLength(short).some(p => p.kind === 'too-short'));
  const asLinkedIn = { ...PLAN.posts[0], channel: 'linkedin' as const };
  assert.ok(checkLength(asLinkedIn).some(p => p.kind === 'too-short'), 'an Instagram caption passed as a LinkedIn post');
});

test('a month where two posts open the same way is caught', () => {
  const bad = planWith([{}, { words: PLAN.posts[0].words }]);
  assert.equal(findRepeatedOpenings(bad.posts).length, 1);
});

test('every gap says what to put in it, and every one is listed at the end', () => {
  assert.equal(listGaps(PLAN).length, 5);
  assert.deepEqual(findEmptyGaps(PLAN), []);
  const lazy = planWith([{ words: PLAN.posts[0].words.replace('three weeks', '[TBC]') }]);
  assert.equal(findEmptyGaps(lazy).length, 1);
  // A month-long document emits the list, and every gap has to be in it.
  // PLAN on its own covers one week, where the list is deliberately absent, so
  // the check is run against the document the rule actually applies to.
  const month = { ...PLAN, weeksWritten: 5, posts: PLAN.posts.map((q, i) => ({ ...q, week: Math.floor(i / 2) + 1 })) };
  assert.equal(findUnlistedGaps(month, exportPlan(month)).length, 0);
  assert.equal(findUnlistedGaps(month, '## What to fill in\n\nnothing').length, 5);
});

/* ── A blank is marked and counted. Listed only when it could be missed ───── */

test('a one-week document does not have to list its blanks again', () => {
  // Raj, 15 September, on the render: "why is this repeated here if it is
  // already covered in this week's tables?" Both blanks are visible in amber
  // and counted in a tile above them, so the list was the third telling.
  const week = { ...PLAN, weeksWritten: 1, posts: PLAN.posts.slice(2, 4).map(p => ({ ...p, week: 1 })) };
  assert.equal(weeksCovered(week), 1);
  assert.deepEqual(validatePlan(week, BARBER, 'no list anywhere in this export').unlistedGaps, []);
});

test('a document covering more than one week still has to', () => {
  const month = { ...PLAN, weeksWritten: 5, posts: PLAN.posts.map((p, i) => ({ ...p, week: Math.floor(i / 2) + 1 })) };
  assert.ok(weeksCovered(month) > 1);
  assert.equal(validatePlan(month, BARBER, 'no list anywhere in this export').unlistedGaps.length, 5);
  assert.deepEqual(validatePlan(month, BARBER, exportPlan(month)).unlistedGaps, []);
});
