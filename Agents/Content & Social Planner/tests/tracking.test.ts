/** What went out, how it did, and what we are allowed to say about it. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChannelTracking } from '../src/types.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bestBy, checkLink, findOverclaimedAccess, findUnboundedSuperlatives, findUnearnedInference, findUnsourcedMetrics, findZeroedGaps, summarise, validateTracking, whyNoMetrics } from '../src/tracking.ts';

const read = { readAt: '2026-09-29T10:00:00.000Z', from: 'instagram' as const };
const post = (at: string, url: string, m?: Record<string, number | null>) =>
  ({ at, url, ...(m ? { metrics: { ...m, read } } : {}) });

const connected: ChannelTracking = {
  channel: 'instagram',
  connection: { state: 'connected', account: '@thebarbershop', tokenExpires: '2026-11-28' },
  published: [post('2026-09-15T09:00:00Z', 'https://instagram.com/p/a', { reached: 210 }),
              post('2026-09-22T09:00:00Z', 'https://instagram.com/p/b', { reached: 412 })],
};

test('the top section counts what went out and when, per channel', () => {
  const [s] = summarise([connected]);
  assert.equal(s.throughUs, 2);
  assert.equal(s.lastPostedOn, '2026-09-22');
  assert.equal(s.label, 'Instagram');
});

test('nothing posted is nought and a null date, never a blank', () => {
  const [s] = summarise([{ ...connected, published: [] }]);
  assert.equal(s.throughUs, 0);
  assert.equal(s.lastPostedOn, null);
});

/* ── The count says which of two things it is counting ────────────────────── */

test('without a connection the count names its own boundary', () => {
  // Raj, 15 September: "Are there no existing posts for this client?" The count
  // said "2 posted" for a barber who has run an Instagram account for years.
  const [s] = summarise([connected]);
  assert.equal(s.onTheAccount, null);
  assert.match(s.countSays, /through here/);
  assert.match(s.countSays, /cannot see/);
});

test('nothing through us still never reads as "you have not posted"', () => {
  // The exact sentence Raj objected to, and the case the first version of this
  // file did not cover: the breakage that replaced this line with "0 posted."
  // came back 0 red. A guard is only as good as its least interesting case.
  const [s] = summarise([{ ...connected, published: [] }]);
  assert.match(s.countSays, /cannot see what is already on your account/);
  assert.doesNotMatch(s.countSays, /^0 posted/);
  assert.doesNotMatch(s.countSays, /never posted|no posts/i);
});

test('with a connection it counts the account, and says how many are ours', () => {
  const withHistory = { ...connected, history: { posts: 148, lastPostedOn: '2026-08-03', read } };
  const [s] = summarise([withHistory]);
  assert.equal(s.onTheAccount, 148);
  assert.equal(s.throughUs, 2);
  assert.match(s.countSays, /148 on the account, 2 of them through here/);
});

test('the last date is the latest of theirs and ours, not whichever we looked at', () => {
  const older = { ...connected, history: { posts: 148, lastPostedOn: '2026-08-03', read } };
  assert.equal(summarise([older])[0].lastPostedOn, '2026-09-22', 'our newer post lost to their older one');
  const newer = { ...connected, history: { posts: 148, lastPostedOn: '2026-09-26', read } };
  assert.equal(summarise([newer])[0].lastPostedOn, '2026-09-26', 'their newer post lost to ours');
});

test('an account with history and nothing through us still counts the history', () => {
  const [s] = summarise([{ ...connected, published: [], history: { posts: 148, lastPostedOn: '2026-08-03', read } }]);
  assert.equal(s.onTheAccount, 148);
  assert.equal(s.throughUs, 0);
  assert.equal(s.lastPostedOn, '2026-08-03');
});

test('the best post is named by a number we actually read', () => {
  const b = bestBy(connected.published)!;
  assert.equal(b.url, 'https://instagram.com/p/b');
  assert.equal(b.value, 412);
  assert.equal(b.metric, 'reached');
});

/* ── A superlative carries its denominator ────────────────────────────────── */

test('the best-of claim says how many it could actually read', () => {
  // The Competitor Tracker found this on its own screen on 15 September: a
  // count asserted past what was read. The same defect was in this file's code
  // AND in tracking.md's worked example of an ALLOWED sentence.
  const four = [
    ...connected.published,
    { at: '2026-09-25T09:00:00Z', url: 'https://instagram.com/p/c' },
    { at: '2026-09-29T09:00:00Z', url: 'https://instagram.com/p/d' },
  ];
  const b = bestBy(four)!;
  assert.equal(b.outOf, 2);
  assert.equal(b.ofPosted, 4);
  assert.match(b.says, /the most of the 2 we have numbers for, out of 4 posted/);
});

test('when every post has a number it says so plainly, without the caveat', () => {
  const b = bestBy(connected.published)!;
  assert.equal(b.outOf, b.ofPosted);
  assert.match(b.says, /the most of your 2\./);
  assert.doesNotMatch(b.says, /we have numbers for/);
});

test('the sentence bestBy builds passes the guard it exists to satisfy', () => {
  assert.deepEqual(findUnboundedSuperlatives(bestBy(connected.published)!.says), []);
});

const unbounded = [
  '412 reached on 22 September, the most this month.',
  'That was your best post.',
  'Your highest reach so far.',
  'This is the top-performing one.',
];
for (const line of unbounded) {
  test(`an unbounded superlative is caught: ${line.slice(0, 30)}`, () => {
    assert.equal(findUnboundedSuperlatives(line).length, 1, line);
  });
}

test('a denominator in the NEXT sentence does not rescue this one', () => {
  // Sentence-scoped, because these lines are read alone: one in a stat tile,
  // one in a feed row, one on a different screen. The Tracker reached the same
  // conclusion testing its own version and fixed the test, not the guard.
  assert.equal(findUnboundedSuperlatives('That was your best post. We have numbers for 2 of 4.').length, 1);
});

test('a plain reading with no superlative is left alone', () => {
  for (const line of ['412 reached on 22 September.', '2 posted on Instagram, the last on 22 September.'])
    assert.deepEqual(findUnboundedSuperlatives(line), [], line);
});

test('best of one is not a finding', () => {
  assert.equal(bestBy([connected.published[0]]), null);
});

/* ── Why there are no numbers always carries its reason ───────────────────── */

test('a personal account is told what is missing and that it is free to fix', () => {
  const t = { ...connected, connection: { state: 'ineligible' as const, because: 'personal-account' as const } };
  const why = whyNoMetrics(t)!;
  assert.match(why, /business or creator account/i);
  assert.doesNotMatch(why, /not checked|unavailable|n\/a/i);
});

test('every state that shows no numbers says why', () => {
  for (const connection of [{ state: 'not-connected' } as const, { state: 'expired', account: '@x' } as const,
                            { state: 'ineligible', because: 'no-linked-page' } as const]) {
    const why = whyNoMetrics({ ...connected, connection });
    assert.ok(why && why.length > 20, JSON.stringify(connection));
  }
  assert.equal(whyNoMetrics(connected), null, 'a working connection claimed a reason it does not have');
});

/* ── We report what happened. We never say why ────────────────────────────── */

const inferences = [
  'Your before-and-afters do better, so post more of them.',
  'That one reached further because it had a photo.',
  'Carousels tend to get more saves for you.',
  'Your price posts outperform the rest.',
  'Stick to the shorter ones.',
];
for (const line of inferences) {
  test(`an inference is refused: ${line.slice(0, 34)}`, () => {
    assert.ok(findUnearnedInference(line).length > 0, line);
  });
}

test('a sourced reading is not an inference', () => {
  for (const line of [
    'Your 22 September post reached 412, the most this month.',
    '4 posted on Instagram, the last on 22 September.',
    'Read from Instagram on 29 September.',
  ]) assert.deepEqual(findUnearnedInference(line), [], line);
});

/* ── A number carries where it came from and when ─────────────────────────── */

test('a metric with no source is caught', () => {
  const bad = { ...connected, published: [{ at: '2026-09-15T09:00:00Z', url: 'u', metrics: { reached: 9 } as never }] };
  assert.equal(findUnsourcedMetrics([bad], new Date('2026-09-30')).length, 1);
});

test('a reading dated in the future was generated, not read', () => {
  assert.equal(findUnsourcedMetrics([connected], new Date('2026-09-20')).length, 2);
  assert.deepEqual(findUnsourcedMetrics([connected], new Date('2026-09-30')), []);
});

test('a zero has to be a real zero, not a missing one', () => {
  assert.equal(findZeroedGaps([post('2026-09-15T09:00:00Z', 'u', { saves: 0 })]).length, 1);
  assert.deepEqual(findZeroedGaps([post('2026-09-15T09:00:00Z', 'u', { saves: null })]), []);
});

/* ── The pasted link ──────────────────────────────────────────────────────── */

test('a real post link passes, and a profile link does not', () => {
  assert.deepEqual(checkLink('https://www.instagram.com/p/Cx1abc/', 'instagram'), []);
  assert.deepEqual(checkLink('https://www.instagram.com/reel/Cx1abc/', 'instagram'), []);
  assert.deepEqual(checkLink('https://instagram.com/thebarbershop', 'instagram'), ['not-a-post']);
});

test('a link to the wrong channel is caught', () => {
  assert.deepEqual(checkLink('https://facebook.com/story/1', 'instagram'), ['wrong-channel', 'not-a-post']);
  assert.deepEqual(checkLink('https://www.facebook.com/x/posts/1', 'facebook'), []);
});

test('empty, not a url, and not https are each caught', () => {
  assert.deepEqual(checkLink('   ', 'instagram'), ['empty']);
  assert.deepEqual(checkLink('instagram.com/p/x', 'instagram'), ['not-a-url']);
  assert.ok(checkLink('http://instagram.com/p/x', 'instagram').includes('not-a-url'));
});

test('a lookalike domain does not pass as the real one', () => {
  assert.ok(checkLink('https://instagram.com.evil.example/p/x', 'instagram').includes('wrong-channel'));
});

test('one pass over the whole section', () => {
  const r = validateTracking([connected], 'Instagram: 2 posted, last 22 September. Best reach 412 on 22 September.', new Date('2026-09-30'));
  assert.deepEqual(r.unsourced, []);
  assert.deepEqual(r.inference, []);
  assert.deepEqual(r.zeroedGaps, []);
  assert.equal(r.summaries[0].throughUs, 2);
});

/* ── What is behind the Connect button ────────────────────────────────────── */

test('the connect copy never implies access we do not ask for', () => {
  for (const line of [
    'Connect and we will post for you every week.',
    'Give us full access to manage your account.',
    'See your followers and schedule posts.',
    'We handle everything from there.',
  ]) assert.ok(findOverclaimedAccess(line).length > 0, line);
});

test('saying what we cannot do is not a claim that we can', () => {
  // One "cannot" governs three clauses here. The first version looked back 30
  // characters, cleared the first clause and flagged the other two.
  const real = 'Connecting signs you in at Instagram and asks you to approve four things. '
    + 'We can then see the posts already on your account and how each one did. '
    + 'We cannot post as you, read your messages, or see who follows you.';
  assert.deepEqual(findOverclaimedAccess(real), []);
});

test('the copy actually on the screen passes its own guard', () => {
  // The guard is worth nothing if it is never run over the real thing.
  const html = readFileSync(join(import.meta.dirname, '..', '..', '..', 'UI', 'workspace.html'), 'utf8');
  const section = html.slice(html.indexOf('What you have posted'), html.indexOf('How often we suggest'));
  const copy = section.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
  assert.deepEqual(findOverclaimedAccess(copy), []);
  assert.match(copy, /cannot post as you/, 'the screen no longer says what we cannot do');
  assert.match(copy, /business or creator account/, 'the screen no longer names what connecting needs');
  assert.match(copy, /60 days/, 'the screen no longer says the sign-in expires');
});
