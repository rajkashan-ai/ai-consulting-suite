/** Recommending a cadence, and refusing to sell it. CLAUDE.md 2b. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadenceOf, findPromisedResults, findUnsourcedReasons, recommendCadence, validateRecommendation } from '../src/recommend.ts';
import { findOverdueLanguage, findPastOccasions } from '../src/guards.ts';
import { BARBER, PLAN, STUDIO, planWith } from './fixtures/businesses.ts';

const CH = ['instagram', 'facebook'] as const;
const ch = () => [...CH];

test('it recommends one, rather than listing three', () => {
  const r = recommendCadence(BARBER, { hoursAWeek: 2 }, ch());
  assert.equal(r.cadence, 'twice-weekly');
  assert.ok(r.because.length >= 2);
});

test('every reason carries a source, and the sources are only the four we hold', () => {
  const r = recommendCadence(BARBER, { hoursAWeek: 2 }, ch());
  for (const reason of r.because) {
    assert.ok(['our-arithmetic', 'they-told-us', 'their-channels', 'last-month'].includes(reason.from), reason.from);
  }
  assert.deepEqual(findUnsourcedReasons(r), []);
});

test('it says what the month costs, in posts and photographs', () => {
  const r = recommendCadence(BARBER, {}, ch());
  assert.ok(r.because.some(x => /9 posts and 9 photographs/.test(x.text)), JSON.stringify(r.because));
});

test('their own answer about their time is taken seriously, not noted', () => {
  assert.equal(recommendCadence(BARBER, { hoursAWeek: 0.5 }, ch()).cadence, 'weekly');
  assert.equal(recommendCadence(BARBER, { hoursAWeek: 5 }, ch()).cadence, 'most-days');
});

/* ── The step up (Raj: "capacity with suggestions for improvement") ───────── */

test('the step up is costed and scoped, and never sold', () => {
  const r = recommendCadence(BARBER, { hoursAWeek: 2 }, ch());
  assert.ok(r.stepUp);
  assert.match(r.stepUp!.costs, /more posts/);
  assert.deepEqual(findPromisedResults(`${r.stepUp!.costs} ${r.stepUp!.covers}`), []);
});

test('there is no step up above the top of the ladder', () => {
  assert.equal(recommendCadence(BARBER, { hoursAWeek: 6 }, ch()).stepUp, undefined);
});

/* ── Month two, the only measured evidence in the feature ─────────────────── */

test('finishing nearly all of it moves them up, and says where the number came from', () => {
  const r = recommendCadence(BARBER, { lastMonth: { written: 9, done: 8 } }, ch());
  assert.equal(r.cadence, 'most-days');
  const from = r.because.find(x => x.from === 'last-month');
  assert.match(from!.text, /8 of 9 done last month/);
});

test('finishing half or less moves them down, by one notch and no more', () => {
  const r = recommendCadence(BARBER, { lastMonth: { written: 22, done: 6 } }, ch());
  assert.equal(r.cadence, 'twice-weekly', 'most-days dropped further than one notch');
  assert.equal(r.steppedDownFrom, 'most-days');
});

test('it never steps below once a week', () => {
  const r = recommendCadence(BARBER, { lastMonth: { written: 4, done: 0 } }, ch());
  assert.equal(r.cadence, 'weekly');
  assert.equal(r.steppedDownFrom, undefined, 'it claimed to step down from the floor');
});

test('a middling month holds them where they are', () => {
  assert.equal(recommendCadence(BARBER, { lastMonth: { written: 9, done: 6 } }, ch()).cadence, 'twice-weekly');
});

test('run one never implies a measurement we did not take', () => {
  // "based on your posting history" is a lie on run one, and we cannot read it
  // on any run: Instagram's robots.txt names ClaudeBot with Disallow: /.
  const r = recommendCadence(BARBER, { hoursAWeek: 2 }, ch());
  assert.deepEqual(findUnsourcedReasons(r), []);
  for (const reason of r.because) assert.notEqual(reason.from, 'last-month');
});

test('a reason claiming a measurement is caught unless it came from our own last plan', () => {
  const faked = {
    cadence: 'twice-weekly' as const,
    because: [{ from: 'our-arithmetic' as const, text: 'You currently post twice a month.' }],
  };
  assert.equal(findUnsourcedReasons(faked).length, 1);
  const real = { ...faked, because: [{ from: 'last-month' as const, text: 'You posted 3 of 9 last month.' }] };
  assert.deepEqual(findUnsourcedReasons(real), []);
});

/* ── The guard the whole feature turns on ─────────────────────────────────── */

const promises = [
  'Three a week will get you more enquiries.',
  'Posting more often tends to bring more customers.',
  'This should help you grow your following.',
  'Businesses that post three times a week see 40% more bookings.',
  'Expect a lift in bookings.',
  'Double your reach by posting daily.',
];

for (const line of promises) {
  test(`a promised result is refused: ${line.slice(0, 34)}`, () => {
    assert.ok(findPromisedResults(line).length > 0, `nothing caught in: ${line}`);
  });
}

test('cost and coverage are not promises', () => {
  for (const line of [
    'Three a week is 13 photographs this month against 9.',
    'You have a Google Business Profile and nothing has gone on it.',
    'At two a week your beard work gets one post a month.',
    'You marked 7 of 9 done last month.',
  ]) assert.deepEqual(findPromisedResults(line), [], line);
});

/* ── Dates are recommendations, not deadlines (§6.7) ──────────────────────── */

test('nothing on the screen may call a post overdue', () => {
  assert.deepEqual(findOverdueLanguage('Tuesday 15 September. Next up.'), []);
  assert.ok(findOverdueLanguage('This post is overdue. You missed Friday.').length >= 2);
  assert.ok(findOverdueLanguage('You have not posted since June, time to catch up.').length >= 2);
});

test('a post tied to an occasion that has gone is caught, and an untied one is not', () => {
  const tied = planWith([{ occasion: { name: 'half term', endsOn: '2026-10-31' } }]);
  assert.deepEqual(findPastOccasions(tied, new Date('2026-10-01')), []);
  assert.equal(findPastOccasions(tied, new Date('2026-11-05')).length, 1);
  assert.deepEqual(findPastOccasions(PLAN, new Date('2027-01-01')), [],
    'a post with no occasion went stale just because the date passed');
});

test('cadenceOf reads a month back from how many posts it held', () => {
  assert.equal(cadenceOf(4), 'weekly');
  assert.equal(cadenceOf(9), 'twice-weekly');
  assert.equal(cadenceOf(22), 'most-days');
});

test('a studio with one channel is not pushed to two a week', () => {
  assert.equal(recommendCadence(STUDIO, {}, ['linkedin']).cadence, 'weekly');
});

/* ── The gate that makes the two guards above actually run ────────────────── */

test('a clean recommendation passes the gate', () => {
  const r = recommendCadence(BARBER, { hoursAWeek: 2 }, ch());
  assert.deepEqual(validateRecommendation(r), { unsourced: [], promised: [], noReasons: false });
});

test('the gate catches a promised result anywhere in the recommendation', () => {
  const r = recommendCadence(BARBER, { hoursAWeek: 2 }, ch());
  const sold = { ...r, stepUp: { ...r.stepUp!, covers: 'Three a week will get you more enquiries.' } };
  assert.ok(validateRecommendation(sold).promised.length > 0, 'the step up sold a result and the gate let it through');
});

test('the gate catches a reason claiming a measurement we never took', () => {
  const faked = {
    cadence: 'weekly' as const,
    because: [{ from: 'our-arithmetic' as const, text: 'Your posting history shows two a month.' }],
  };
  assert.equal(validateRecommendation(faked).unsourced.length, 1);
});

test('a recommendation with no reason at all is caught', () => {
  assert.equal(validateRecommendation({ cadence: 'weekly', because: [] }).noReasons, true);
});
