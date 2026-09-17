/**
 * Is a competitor still trading, and how busy are they now?
 *
 * This file exists because the screen once claimed we could not tell. The block
 * was real, the conclusion was not: an uncheck has to name the question, not the
 * method, and this question had another route all along.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewDatesFrom, activityFrom, verdict, describeActivity, newestLastmod, QUIET_AFTER_DAYS,
} from '../src/activity.ts';
import { findUnsourcedClaims, findUnexplainedGaps } from '../src/guards.ts';

const NOW = new Date('2026-09-14T12:00:00.000Z');
const SRC = { url: 'https://booksy.com/en-gb/12884_hinces', fetchedOn: '2026-09-14' };
const wrap = (c: ReturnType<typeof describeActivity>) =>
  [{ name: 'x', addedByCustomer: false, claims: { reviews: [c] } }];

/* ── Reading the dates out of a page ──────────────────────────────────────── */

test('schema.org review dates are preferred, because they are unambiguous', () => {
  const html = `<script type="application/ld+json">{"@type":"Review","datePublished":"2026-09-11"}</script>
                <p>Page cached on 2026-09-09</p>`;
  // The cache timestamp must not be mistaken for a review: that mistake was made
  // once already, on a competitor's website.
  assert.deepEqual(reviewDatesFrom(html), ['2026-09-11']);
});

test('a page with no schema falls back to any dates it carries', () => {
  assert.deepEqual(reviewDatesFrom('<p>2026-09-11</p><p>2026-08-02</p>'), ['2026-08-02', '2026-09-11']);
});

test('a page with no dates at all returns nothing, not a guess', () => {
  assert.deepEqual(reviewDatesFrom('<p>Great barber</p>'), []);
});

test('duplicates are collapsed, so two reviews on one day count once as a date', () => {
  const html = '"datePublished":"2026-09-11" "datePublished":"2026-09-11"';
  assert.deepEqual(reviewDatesFrom(html), ['2026-09-11']);
});

/* ── Turning dates into an answer ─────────────────────────────────────────── */

test('the newest review and its age are read correctly', () => {
  const a = activityFrom(['2026-09-10', '2026-08-30', '2026-07-01'], NOW);
  assert.equal(a.lastReviewOn, '2026-09-10');
  assert.equal(a.daysSince, 4);
});

test('a review dated in the future is ignored rather than trusted', () => {
  const a = activityFrom(['2027-01-01', '2026-09-10'], NOW);
  assert.equal(a.lastReviewOn, '2026-09-10');
});

test('an unparseable date does not take the run down', () => {
  const a = activityFrom(['last Tuesday', '2026-09-10'], NOW);
  assert.equal(a.lastReviewOn, '2026-09-10');
  assert.equal(a.sampleSize, 1);
});

test('no reviews is unknown, not quiet', () => {
  // A business with no reviews might be rushed off its feet. We cannot tell, and
  // saying "quiet" would be an invention.
  const a = activityFrom([], NOW);
  assert.equal(a.lastReviewOn, null);
  assert.equal(verdict(a), 'unknown');
});

test('a business reviewed this week and often is busy', () => {
  const recent = ['2026-09-12', '2026-09-10', '2026-09-08', '2026-09-05', '2026-09-01', '2026-08-28'];
  assert.equal(verdict(activityFrom(recent, NOW)), 'busy');
});

test('one review this month is only "trading": a rate needs a sample', () => {
  assert.equal(verdict(activityFrom(['2026-09-10'], NOW)), 'trading');
});

test('a rate is never stated off a sample too small to be a rate', () => {
  // A Booksy page carries two dated reviews. "2 of 2 in the last 30 days" is
  // arithmetic on two, and reads as a finding when it is noise.
  const c = describeActivity('HINCES', activityFrom(['2026-09-10', '2026-09-08'], NOW), SRC);
  assert.equal(c.text, 'HINCES: last review 4 days ago');
  assert.ok(!/of the 2 reviews/.test(c.text));
});

test(`nothing for ${QUIET_AFTER_DAYS} days is quiet`, () => {
  assert.equal(verdict(activityFrom(['2026-06-01'], NOW)), 'quiet');
});

/* ── What we are allowed to say about it ──────────────────────────────────── */

/**
 * A venue page shows a sample of reviews, not all of them. "13 reviews in the
 * last 30 days" is a total we do not have.
 */
test('a count over a window always says what it was counted out of', () => {
  const a = activityFrom(['2026-09-10', '2026-09-08', '2026-09-04', '2026-08-20', '2026-08-02', '2026-06-01'], NOW);
  const c = describeActivity('HINCES', a, SRC);
  assert.match(c.text, /4 of the 6 reviews on their page/);   // 2 Aug is 43 days back
  assert.ok(!/\b4 reviews in the last 30 days\b/.test(c.text), 'stated a total we do not have');
});

test('every activity claim carries its source', () => {
  const c = describeActivity('HINCES', activityFrom(['2026-09-10'], NOW), SRC);
  assert.deepEqual(findUnsourcedClaims(wrap(c)), []);
});

test('no reviews reads as a finding with its reason, not a bare gap', () => {
  const c = describeActivity('You', activityFrom([], NOW), SRC);
  assert.equal(c.value, null);
  assert.deepEqual(findUnexplainedGaps(wrap(c)), []);
  assert.match(c.text, /nothing here says whether they are busy/);
});

test('today and yesterday read as words, because "0 days ago" reads as broken', () => {
  assert.match(describeActivity('X', activityFrom(['2026-09-14'], NOW), SRC).text, /last review today/);
  assert.match(describeActivity('X', activityFrom(['2026-09-13'], NOW), SRC).text, /last review yesterday/);
});

/* ── The real barber run, 14 September 2026 ───────────────────────────────── */

test('the three competitors on Booksy all reviewed within four days', () => {
  const real: [string, string[]][] = [
    ['HINCES', ['2026-09-10', '2026-09-08', '2026-08-30']],
    ['The Fade Inn', ['2026-09-11', '2026-09-02']],
    ['NO.1 Barbers', ['2026-09-11', '2026-09-05']],
  ];
  for (const [name, dates] of real) {
    const a = activityFrom(dates, NOW);
    assert.ok(a.daysSince !== null && a.daysSince <= 4, `${name} came back as ${a.daysSince} days`);
    assert.notEqual(verdict(a), 'quiet');
    assert.notEqual(verdict(a), 'unknown');
  }
});

/* ── The website, as a second and weaker signal ───────────────────────────── */

test('a sitemap gives the date the site was last touched', () => {
  const xml = '<url><lastmod>2024-07-01</lastmod></url><url><lastmod>2023-01-04</lastmod></url>';
  assert.equal(newestLastmod(xml), '2024-07-01');
});

test('a sitemap with no lastmod tells us nothing, and says so', () => {
  assert.equal(newestLastmod('<url><loc>https://example.com/</loc></url>'), null);
});
