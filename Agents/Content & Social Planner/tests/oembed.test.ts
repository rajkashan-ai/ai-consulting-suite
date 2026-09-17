/**
 * Reading the published caption back. The half of tracking with no blocker.
 *
 * Every case injects the fetcher. A test that depends on Instagram being up is
 * a test that fails on a Tuesday for a reason nobody can fix, and then gets
 * disabled. The one live call that proved the endpoint takes unauthenticated
 * requests is recorded in `tracking.md`, not run here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captionFrom, classifyError, fetchPublishedCaption, OEMBED, SAYS } from '../src/oembed.ts';

const reply = (body: unknown) => async () => ({ status: 200, json: async () => body });
const EMBED = '<blockquote class="instagram-media"><a href="x">'
  + '<p>Beard sculpting is not a trim.<br/>It is &#39;20 and holds three weeks.</p></a>'
  + '<p>A post shared by The Barber Shop (@thebarbershop)</p></blockquote>';

test('a good reply gives the caption and the author', async () => {
  const r = await fetchPublishedCaption('https://instagram.com/p/a', reply({ html: EMBED, author_name: 'The Barber Shop' }));
  assert.ok(r.ok);
  assert.equal(r.caption, "Beard sculpting is not a trim.\nIt is '20 and holds three weeks.");
  assert.equal(r.author, 'The Barber Shop');
});

test("Instagram's own footer line is not part of their caption", async () => {
  const r = await fetchPublishedCaption('https://instagram.com/p/a', reply({ html: EMBED }));
  assert.ok(r.ok && !r.caption.includes('A post shared by'));
});

test('entities and line breaks survive, because a diff compares them', async () => {
  assert.equal(captionFrom('<blockquote><p>Cut &amp; beard &#39;20<br/>Six days</p></blockquote>'), "Cut & beard '20\nSix days");
});

test('markup we do not recognise returns nothing, and never throws', () => {
  // Meta owns this shape and can change it. A plan that cannot read one caption
  // has learned nothing; a plan that crashes has lost the month.
  assert.doesNotThrow(() => captionFrom('<div>something else entirely</div>'));
  assert.equal(captionFrom(''), '');
});

/* ── Errors, mapped once, and never shown in Meta's own words ─────────────── */

test('every error code the endpoint really returns is classified', () => {
  // 24 and 100 were both seen live on 15 September.
  assert.equal(classifyError(24), 'not-found');
  assert.equal(classifyError(100), 'bad-request');
  assert.equal(classifyError(4), 'rate-limited');
  assert.equal(classifyError(1234), 'unavailable');
});

test('a missing post is reported as missing, with something to do about it', async () => {
  const r = await fetchPublishedCaption('https://instagram.com/p/gone',
    reply({ error: { code: 24, message: 'The requested resource does not exist' } }));
  assert.ok(!r.ok && r.because === 'not-found');
  assert.match(SAYS[r.because], /give it a minute/);
});

test('the customer never reads Meta\'s wording', () => {
  for (const [kind, line] of Object.entries(SAYS)) {
    assert.doesNotMatch(line, /OAuthException|error_subcode|fbtrace|resource does not exist|#\d+/, kind);
    assert.ok(line.length > 40, kind);
  }
});

test('a rate limit is not the owner\'s problem and says so', () => {
  assert.match(SAYS['rate-limited'], /nothing for you to do/);
});

test('the post is recorded even when the read fails', () => {
  // Pressing Posted is their statement that it went out. Our failure to read it
  // back must never look like a failure to record it.
  assert.match(SAYS['unavailable'], /recorded either way/);
});

test('a network failure is caught rather than thrown at the caller', async () => {
  const r = await fetchPublishedCaption('https://instagram.com/p/a', async () => { throw new Error('ETIMEDOUT'); });
  assert.ok(!r.ok && r.because === 'unavailable');
  assert.match(r.detail, /ETIMEDOUT/);
});

test('we never send a token, because the endpoint does not need one', async () => {
  let asked = '';
  await fetchPublishedCaption('https://instagram.com/p/a', async (u) => { asked = u; return { status: 200, json: async () => ({}) }; });
  assert.ok(asked.startsWith(OEMBED));
  assert.doesNotMatch(asked, /access_token|client_secret|app_id/);
  assert.match(asked, /url=https%3A%2F%2Finstagram\.com%2Fp%2Fa/);
});
