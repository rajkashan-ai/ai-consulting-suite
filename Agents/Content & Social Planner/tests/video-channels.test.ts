/**
 * TikTok and YouTube.
 *
 * Adding a channel is not a line in a list. Every post carries an instruction
 * for the thing the owner has to supply, and on a video channel a photograph is
 * advice they cannot act on. A YouTube upload with an empty title box cannot be
 * posted at all, so a post without one is not the finished post CLAUDE.md 3
 * promises.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANNEL } from '../src/types.ts';
import { write, firstLine } from '../src/write.js';
import { channels } from '../src/extract.js';
import { renderScreen } from '../src/render.js';

const facts = { name: 'X', known: { prices: { 'classic cut': '£15' }, services: ['classic cut'] } };
const slot = (channel: string) => ({ channel, angle: 'what-it-costs', kind: 'useful', purpose: 'useful', date: '2026-09-15', week: 1 });

test('both channels are on the list, with a length and a medium', () => {
  for (const c of ['tiktok', 'youtube'] as const) {
    assert.ok(CHANNEL[c], `${c} is not a channel`);
    assert.equal(CHANNEL[c].medium, 'video');
    assert.ok(CHANNEL[c].words[0] > 0 && CHANNEL[c].words[1] > CHANNEL[c].words[0], `${c} has no word target`);
    assert.ok(CHANNEL[c].capChars > 100, `${c} has no character cap`);
  }
});

test('every channel declares what the owner has to supply', () => {
  for (const [name, c] of Object.entries(CHANNEL)) {
    assert.ok(c.medium === 'photo' || c.medium === 'video', `${name} does not say photo or video`);
  }
});

test('a video post asks them to film, never to photograph', () => {
  for (const c of ['tiktok', 'youtube']) {
    const r = write(slot(c) as any, facts as any);
    assert.doesNotMatch(r.shot, /photo(graph)?\b/i, `${c} asked for a photograph`);
    assert.match(r.shot, /film|camera|clip|take\b/i, `${c} gave no filming instruction`);
  }
});

test('a photo post is unchanged', () => {
  const r = write(slot('instagram') as any, facts as any);
  assert.match(r.shot, /price list/i);
  assert.equal(r.title, undefined, 'Instagram has no title field to fill');
});

test('a YouTube post carries a title, inside the cap, not cut mid-word', () => {
  const r = write(slot('youtube') as any, facts as any);
  assert.ok(r.title, 'no title, so it cannot be uploaded');
  assert.ok(r.title!.length <= CHANNEL.youtube.titleChars!, `title is ${r.title!.length} chars`);
  assert.doesNotMatch(r.title!, /\[|\]/, 'a blank leaked into the title');
  assert.doesNotMatch(r.title!, /\s$/);
});

test('a long opening sentence is trimmed at a space, not through a word', () => {
  const sentence = 'We have been cutting hair on this street for a very long time indeed and we know every head in it.';
  assert.ok(sentence.length > 90, 'the fixture is not long enough to be trimmed');
  const t = firstLine(sentence, 90);
  assert.ok(t.length <= 90, `got ${t.length}`);
  assert.ok(sentence.startsWith(t), 'the trim changed the words');
  assert.equal(sentence[t.length], ' ', 'trimmed through a word');
});

test('a sentence that already fits is left exactly alone', () => {
  assert.equal(firstLine('Short enough.', 90), 'Short enough.');
});

test('a linked TikTok or YouTube account is found', () => {
  assert.deepEqual(channels('<a href="https://www.tiktok.com/@thebarbershop">us</a>'),
    [{ channel: 'tiktok', handle: 'thebarbershop' }]);
  for (const href of ['youtube.com/@barbers', 'youtube.com/c/barbers', 'youtube.com/channel/barbers', 'youtube.com/user/barbers']) {
    assert.deepEqual(channels(`<a href="https://${href}">us</a>`), [{ channel: 'youtube', handle: 'barbers' }], href);
  }
});

test('the screen says Film over a video instruction and shows the title', () => {
  const plan = {
    channels: ['youtube'], voice: 'We cut hair in Shrewsbury and we are quick about it.',
    recommendation: { cadence: 'weekly', because: [{ text: 'You said once a week.' }] },
    posts: [{ ...slot('youtube'), purpose: 'useful', ...write(slot('youtube') as any, facts as any) },
      { ...slot('youtube'), date: '2026-09-22', week: 2 }],
  };
  const html = renderScreen(plan as any, { name: 'X', readAt: '2026-09-14', pages: ['u'], channels: [], known: { prices: {}, services: [] } } as any);
  assert.match(html, />Film</, 'the card still says Photograph');
  assert.match(html, />Title</, 'the title is not on the card');
  assert.match(html, /You film 1 clip\./, 'the headline still counts photographs');
});

const fourChannel = (chs: string[]) => renderScreen({
  channels: chs, voice: 'We cut hair in Shrewsbury and we are quick about it.',
  recommendation: { cadence: 'twice-weekly', because: [{ text: 'You said a couple of times a week.' }] },
  posts: chs.map((c, i) => ({ ...slot(c), purpose: 'useful', date: `2026-09-1${5 + i}`, week: 1, ...write(slot(c) as any, facts as any) })),
} as any, { name: 'X', readAt: '2026-09-14', pages: ['u'], channels: [], known: { prices: {}, services: [] } } as any);

test('Meta\'s account rules are not stated as TikTok\'s or YouTube\'s', () => {
  const html = fourChannel(['instagram', 'facebook', 'tiktok', 'youtube']);
  const meta = /business or creator account joined to a Facebook page/g;
  assert.equal((html.match(meta) || []).length, 2, 'the Meta requirement is shown for channels it does not apply to');
});

test('we do not offer to connect something we have not built', () => {
  const html = fourChannel(['instagram', 'facebook', 'tiktok', 'youtube']);
  assert.match(html, /Connect Instagram/);
  assert.doesNotMatch(html, /Connect TikTok|Connect YouTube/);
  assert.match(html, /cannot connect this one yet/i, 'nothing says why there is no button');
});

test('a video-only plan shows no connect controls at all, not an empty bar', () => {
  const html = fourChannel(['tiktok', 'youtube']);
  assert.doesNotMatch(html, /<button class="btn--ghost" type="button">Connect/);
  assert.doesNotMatch(html, /<div class="controls"><\/div>/, 'an empty control bar was rendered');
});
