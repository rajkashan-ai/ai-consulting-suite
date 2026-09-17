/** The shape of the month. CLAUDE.md 3a. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIX, CADENCES } from '../src/types.ts';
import { planDates, postCount, postDays, slotWeeks, validateShape, PLAN_DAYS } from '../src/plan-shape.ts';
import { PLAN, planWith } from './fixtures/businesses.ts';

test('the clean plan has nothing wrong with its shape', () => {
  assert.deepEqual(validateShape(PLAN), []);
});

test('every cadence posts as many times as its mix adds up to', () => {
  for (const c of CADENCES) assert.equal(postDays(c).length, postCount(c), c);
});

test('the mix is whole posts, not a percentage of four', () => {
  // 70 per cent of four posts is 2.8 posts, which is why the draft's ratio was
  // arithmetic nobody could satisfy.
  assert.deepEqual(MIX['weekly'], { useful: 3, question: 0, offer: 1 });
  for (const c of CADENCES) assert.ok(MIX[c].offer >= 1, `${c} has no ask in it`);
  for (const c of CADENCES) assert.ok(MIX[c].offer <= 2, `${c} asks three times in a month`);
});

test('nothing lands outside the thirty days, and most-days means five days a week', () => {
  for (const c of CADENCES) {
    const days = postDays(c);
    assert.ok(days.every(d => d >= 0 && d < PLAN_DAYS), c);
    assert.deepEqual([...days].sort((a, b) => a - b), days, `${c} is out of order`);
  }
  assert.equal(postDays('most-days').length, 22);
  assert.ok(!postDays('most-days').includes(5), 'a business is posting on day six of seven');
});

test('dates start the day after the run and never before it', () => {
  const dates = planDates('twice-weekly', '2026-09-14T09:00:00.000Z');
  assert.equal(dates[0], '2026-09-15');
  assert.equal(dates.length, 9);
  assert.deepEqual(dates, PLAN.posts.map(p => p.date));
});

test('a post dated before the run is caught', () => {
  const bad = planWith([{ date: '2026-09-01' }]);
  assert.ok(validateShape(bad).some(p => p.kind === 'date-in-the-past'));
});

test('two posts on one day is caught', () => {
  const bad = planWith([{}, { date: '2026-09-15' }]);
  assert.ok(validateShape(bad).some(p => p.kind === 'two-posts-one-day'));
});

test('the same angle twice running is caught', () => {
  const bad = planWith([{}, { angle: 'how-it-works' }]);
  assert.ok(validateShape(bad).some(p => p.kind === 'angle-twice-running'));
});

test('a fourth use of one angle in a month is caught', () => {
  const bad = planWith([
    { angle: 'how-it-works' }, { angle: 'what-it-costs' }, { angle: 'how-it-works' },
    { angle: 'what-it-costs' }, { angle: 'how-it-works' }, { angle: 'what-it-costs' },
    { angle: 'how-it-works' },
  ]);
  assert.ok(validateShape(bad).some(p => p.kind === 'angle-overused'));
});

test('a channel they never confirmed is caught, and so is one we ignored', () => {
  assert.ok(validateShape(planWith([{ channel: 'linkedin' }])).some(p => p.kind === 'channel-not-theirs'));
  const ignored = { ...PLAN, channels: ['instagram', 'facebook', 'google-business'] as const };
  assert.ok(validateShape({ ...ignored, channels: [...ignored.channels] }).some(p => p.kind === 'channel-unused'));
});

test('more posts than the cadence asked for is caught', () => {
  const bad = { ...PLAN, posts: [...PLAN.posts, PLAN.posts[0]] };
  assert.ok(validateShape(bad).some(p => p.kind === 'wrong-count'));
});

test('a month with no ask in it has failed at its job', () => {
  const bad = planWith(Array(9).fill({}).map((_, i) => (i === 8 ? { purpose: 'useful' as const } : {})));
  const problems = validateShape(bad);
  assert.ok(problems.some(p => p.kind === 'no-offer'));
  assert.ok(problems.some(p => p.kind === 'wrong-mix'));
});

/* ── Shaped in full on day one, written a week at a time (CLAUDE.md 3) ────── */

test('the shape of the whole month exists before any of it is written', () => {
  // This is what makes the mix and the no-repeat rule hold for weeks nobody
  // has written. Both are checked on the shape, never on the words.
  const shapeOnly = { ...PLAN, weeksWritten: 0, posts: PLAN.posts.map(p => ({ ...p, words: '', shot: '', why: '' })) };
  const problems = validateShape(shapeOnly);
  assert.ok(!problems.some(p => p.kind === 'wrong-mix'), 'the mix stopped holding once the words were gone');
  assert.ok(!problems.some(p => p.kind === 'angle-twice-running'));
  assert.ok(!problems.some(p => p.kind === 'wrong-count'));
});

test('words in a week nobody has written yet are caught', () => {
  const p = { ...PLAN, weeksWritten: 1, posts: PLAN.posts.map((x, i) => ({ ...x, week: Math.floor(i / 2) + 1 })) };
  assert.ok(validateShape(p).some(q => q.kind === 'words-in-an-unwritten-week'));
});

test('a written week with a post missing its words is caught', () => {
  const posts = PLAN.posts.map((x, i) => ({ ...x, week: 1, words: i === 2 ? '' : x.words }));
  assert.ok(validateShape({ ...PLAN, weeksWritten: 1, posts }).some(q => q.kind === 'no-words-in-a-written-week'));
});

test('a slot claiming the wrong week is caught', () => {
  const posts = PLAN.posts.map((x, i) => ({ ...x, week: i === 0 ? 4 : slotWeeks(PLAN.cadence)[i] }));
  assert.ok(validateShape({ ...PLAN, posts }).some(q => q.kind === 'wrong-week'));
});

test('a plan written before 15 September, with no weeksWritten, still validates', () => {
  assert.deepEqual(validateShape(PLAN), []);
});

test('an angle that is not in the named set is caught', () => {
  // ANGLES sat in types.ts read by nothing until 15 September, so a plan could
  // carry an invented angle and the no-repeat rule would happily count it.
  // Wiring it was not enough: the first breakage run showed 0 tests went red,
  // because nothing covered the guard that had just been added.
  const bad = planWith([{ angle: 'a-vibe-we-made-up' as never }]);
  const problems = validateShape(bad);
  assert.ok(problems.some(p => p.kind === 'angle-not-in-the-set'), JSON.stringify(problems));
  assert.deepEqual(validateShape(PLAN).filter(p => p.kind === 'angle-not-in-the-set'), []);
});

test('a week number outside the month is caught', () => {
  const bad = planWith([{ week: 9 }]);
  assert.ok(validateShape(bad).some(p => p.kind === 'week-outside-the-month'));
  assert.ok(validateShape(planWith([{ week: 0 }])).some(p => p.kind === 'week-outside-the-month'));
});
