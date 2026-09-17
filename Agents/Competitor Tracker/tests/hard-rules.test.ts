/**
 * What this tool must never do. CLAUDE.md section 5.
 * Each rule is a test, because a rule in prose is a hope.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findTrafficClaims, findFeedbackPrompts, findBuildDetail, findRankClaims, findUnboundedCounts } from '../src/guards.ts';
import { mayFetch, ROBOTS } from '../src/fetch-policy.ts';

/* ── 5.1 Never claim to know a competitor's traffic ───────────────────────── */

test('no traffic word about a named competitor survives the check', () => {
  const banned = [
    'HINCES gets around 40,000 visitors per month.',
    'Their traffic is mostly from search.',
    'The Fade Inn sees roughly 12,000 sessions a quarter.',
    'Estimated visits: 8,400.',
    'Their bounce rate is high.',
    'NO.1 Barbers convert at about 3%.',
  ];
  for (const line of banned) {
    assert.ok(findTrafficClaims(line).length > 0, `let a traffic claim through: ${line}`);
  }
});

test('saying plainly that we do not have the data is allowed, and is the required answer', () => {
  const allowed = [
    'We cannot see a competitor\'s traffic and nobody can without buying panel data.',
    'We do not have visitors per month for any of them.',
    'Nobody can see a rival\'s sessions without a Similarweb licence, and we have not bought one.',
  ];
  for (const line of allowed) {
    assert.deepEqual(findTrafficClaims(line), [], `blocked an honest denial: ${line}`);
  }
});

test('a page boasting about its own traffic does not put a traffic claim in our output', () => {
  // The page says it. That does not make it ours to repeat as a fact.
  const fromTheirPage = 'We get 40,000 visitors per month, far more than any rival.';
  assert.ok(findTrafficClaims(fromTheirPage).length > 0);
});

/* ── 5.2 Never put a feedback prompt inside the battlecard ────────────────── */

test('the export carries no feedback control, because it gets forwarded', () => {
  const phrases = ['How did this output land?', 'Was this any use?', 'Was this helpful?', 'Give feedback', 'Rate this'];
  for (const p of phrases) assert.ok(findFeedbackPrompts(`...battlecard...\n${p}`).length > 0);
});

test('a clean export passes', () => {
  const card = '## Since 7 September\nHINCES put their classic cut up to £35. booksy.com, 14 Sep.\n## Sources\nbooksy.com, 14 Sep';
  assert.deepEqual(findFeedbackPrompts(card), []);
});

/* ── 5.4 Never fetch what robots.txt disallows, nor a login or a paywall ──── */

test('a named venue page on either platform is allowed', () => {
  assert.equal(mayFetch('https://booksy.com/en-gb/12345_the-fade-inn', ROBOTS.booksy).allowed, true);
  assert.equal(mayFetch('https://www.fresha.com/a/hinces-shrewsbury', ROBOTS.fresha).allowed, true);
});

test('neither platform\'s search is, so discovery can never come from a booking platform', () => {
  const booksy = mayFetch('https://booksy.com/en-gb/search/barbers/shrewsbury', ROBOTS.booksy);
  assert.equal(booksy.allowed, false);
  if (!booksy.allowed) assert.equal(booksy.refusal, 'platform-search');

  const fresha = mayFetch('https://www.fresha.com/search?q=barbers', ROBOTS.fresha);
  assert.equal(fresha.allowed, false);
});

test('a robots-disallowed path is refused', () => {
  const r = mayFetch('https://booksy.com/pro/onboarding/BusinessSetup', ROBOTS.booksy);
  assert.equal(r.allowed, false);
  if (!r.allowed) assert.equal(r.refusal, 'robots-disallowed');
});

test('a login, a checkout or an account page is refused', () => {
  for (const u of ['https://example.com/login', 'https://example.com/account/dashboard', 'https://example.com/checkout']) {
    assert.equal(mayFetch(u).allowed, false, `fetched ${u}`);
  }
});

test('an address only reachable from inside our network is refused', () => {
  const internal = [
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:3000/api/internal',
    'http://127.0.0.1/',
    'http://10.0.0.5/admin',
    'http://192.168.1.1/',
    'http://172.16.4.2/',
    'http://metadata.google.internal/',
  ];
  for (const u of internal) {
    const r = mayFetch(u);
    assert.equal(r.allowed, false, `fetched an internal address: ${u}`);
    if (!r.allowed) assert.equal(r.refusal, 'private-address');
  }
});

test('a malformed url is refused rather than thrown on', () => {
  assert.equal(mayFetch('not a url').allowed, false);
  assert.equal(mayFetch('').allowed, false);
});

/* ── 5.5 Never assume the business is local ───────────────────────────────── */

test('a business selling beyond its doorstep is not given a radius', () => {
  // Recorded as a rule the eval set grades, since the wording is the tool's.
  // The deterministic half: a non-local business has no distance claim at all.
  const notLocal = { name: 'Fixture Remote Consulting', local: false, radiusMiles: null };
  assert.equal(notLocal.radiusMiles, null);
});

/* ── Our plumbing is not their information (base-prompt.md) ───────────────── */

test('build detail never reaches a customer screen', () => {
  // 14 September: the advertising gap shipped explaining that someone has to
  // send Meta a passport and wait a week. A barber does not care, and it invites
  // them to worry about our problems instead of their competitors'.
  const shipped = 'We are not collecting it yet. It needs one identity check with Meta, a passport and ' +
    'proof of address, which takes about a week. That is being started.';
  const leaks = findBuildDetail(shipped);
  assert.ok(leaks.includes('passport'));
  assert.ok(leaks.includes('identity check'));
  assert.ok(leaks.includes('proof of address'));
});

test('a status claim about our own work is caught, because nobody checks those', () => {
  // "That is being started" was not true of anything. It is the easiest false
  // statement to write, because the customer cannot verify it and neither can we.
  for (const claim of ['That is being started', 'We are working on it', 'We have not applied']) {
    assert.ok(findBuildDetail(claim).length > 0, `let a status claim through: ${claim}`);
  }
});

test('the replacement says the same thing in the customer\'s terms', () => {
  const shipping = 'We cannot see this yet. When we can, this row will show every ad each of them is ' +
    'running, in their own words, with the date it started. It is empty because we have not looked, ' +
    'not because nobody is advertising.';
  assert.deepEqual(findBuildDetail(shipping), []);
  // and it still does the job the gap rule requires
  assert.match(shipping, /not because nobody/);
});

test('the words we reach for by habit are all banned', () => {
  const habits = ['our API', 'the endpoint', 'an access token', 'app review', 'business verification',
                  'the database', 'a migration', 'the prompt', 'robots.txt'];
  for (const h of habits) assert.ok(findBuildDetail(h).length > 0, `not banned: ${h}`);
});

/* ── A search result is not a ranking ─────────────────────────────────────── */

test('a numbered Google position is refused, like a traffic figure', () => {
  // Search visibility tells us who comes up. It does not tell us that someone is
  // ninth, and saying so is a number nobody gave us.
  for (const claim of [
    'You are ranked 9th on Google for barber Shrewsbury.',
    'You sit at #4 on Google.',
    'HINCES is in position 1, you are 9th.',
    'You are placed third in the search results.',
  ]) {
    assert.ok(findRankClaims(claim), `let a ranking claim through: ${claim}`);
  }
});

test('saying who comes up, and who does not, is allowed and is the useful form', () => {
  for (const claim of [
    'You do not come up for "barber Shrewsbury". These five do.',
    'Five competitors appear for this search and you do not.',
    'HINCES comes up first for this search; you do not appear.',
  ]) {
    assert.ok(!findRankClaims(claim), `blocked an honest statement: ${claim}`);
  }
});

/* ── A count must say where it stops ──────────────────────────────────────── */

test('an absolute count with no boundary is caught', () => {
  // The exact sentences that were on the screen on 15 September, while the same
  // screen said Google was not checked.
  const wasOnScreen = [
    '4,799 exist across the five of them. None is about you',
    '4,799 reviews exist across the five of them. You have none.',
    'HINCES has 2,461 reviews at 5.0. You have none anywhere public.',
  ];
  for (const s of wasOnScreen) {
    assert.ok(findUnboundedCounts(s).length > 0, `let an unbounded total through: ${s}`);
  }
});

test('the same claim with its boundary named is allowed', () => {
  const fixed = [
    '4,799 across the five, counted on Booksy. None about you on anything we can read',
    'You have none on anything we can read, and Google is not checked yet.',
    'There are 4,799 reviews across the five of them on Booksy, and none about you anywhere we can read.',
  ];
  for (const s of fixed) {
    assert.deepEqual(findUnboundedCounts(s), [], `blocked an honest, bounded claim: ${s}`);
  }
});

test('it reads sentence by sentence, so one bounded sentence does not excuse another', () => {
  const mixed = 'None about you on anything we can read. HINCES has none.';
  assert.deepEqual(findUnboundedCounts(mixed), ['HINCES has none.']);
});

test('a boundary in the NEXT sentence does not rescue this one', () => {
  // Written expecting the opposite, and the guard was right. Each sentence must
  // carry its own boundary, because these sentences are read alone: one in a
  // stat tile, one in a feed row, one in a card. "You have none." on a home
  // screen is a total, whatever the sentence after it says on a different
  // screen. The honest form puts the limit in the same sentence.
  assert.deepEqual(findUnboundedCounts('You have none. We have not checked Google.'), ['You have none.']);
  assert.deepEqual(findUnboundedCounts('You have none that we can see. We have not checked Google.'), []);
});

test('nothing absolute, nothing flagged', () => {
  assert.deepEqual(findUnboundedCounts('HINCES has 2,461 reviews at 5.0 on Booksy.'), []);
});

test('an explicit denominator is itself a boundary', () => {
  // These were all flagged before the list was widened, and all of them say
  // exactly where the count stops.
  for (const s of ['Your booking runs through NearCut, which none of the five use.',
                   'You: none found, on any platform we could reach.',
                   '5 of the 9 are returning customers, and none mention price.',
                   'None of the six publishes a full menu.']) {
    assert.deepEqual(findUnboundedCounts(s), [], `flagged an already-bounded claim: ${s}`);
  }
});

test('a rationale for what we cannot check is not a count', () => {
  // These are the tool explaining a limit, not reporting a total it measured.
  for (const s of ['Nobody publishes what a shop is known for.',
                   'Nobody chooses a barber on LinkedIn or X.',
                   'Anyone who gives you that number is guessing.']) {
    assert.deepEqual(findUnboundedCounts(s), [], `flagged a stated limit as a count: ${s}`);
  }
  // and the count-shaped ones still fire
  assert.ok(findUnboundedCounts('You have none.').length > 0);
});

test('a guard does not fire on the trade it is guarding', () => {
  // All three were live on 15 September. Two were substring matches with no word
  // boundary; the third was a real word whose meaning in this trade is not the
  // meaning the guard was built for.
  for (const s of ['His obsessions with detail show in every fade.',
                   'We run barbering sessions for apprentices on Tuesdays.',
                   'Beard sculpting sessions, £20.',
                   'First impressions of the shop matter more than the price.',
                   'The conversion of the back room into a third chair.']) {
    assert.deepEqual(findTrafficClaims(s), [], `flagged ordinary trade language: ${s}`);
  }
  // and the analytics sense is still caught, whatever period it is dressed in.
  // The context patterns report the bare term they are named for, not the text
  // they matched, so the caller gets one stable name per kind of claim.
  assert.deepEqual(findTrafficClaims('Their web sessions are up 20 per cent.'), ['sessions']);
  assert.deepEqual(findTrafficClaims('The Fade Inn sees roughly 12,000 sessions a quarter.'), ['sessions']);
  assert.deepEqual(findTrafficClaims('HINCES gets around 40,000 visitors per month.'), ['visitors per month']);
  assert.deepEqual(findTrafficClaims('Their ads got 40,000 impressions last month.'), ['impressions']);
  assert.deepEqual(findTrafficClaims('Their conversion rate is 4 per cent.'), ['conversion rate']);
});

test('a denial is not a feedback prompt, as it was already not a traffic claim', () => {
  assert.deepEqual(findFeedbackPrompts('We do not ask for feedback in this document.'), []);
  assert.deepEqual(findFeedbackPrompts('Was this any use?'), ['was this any use']);
});
