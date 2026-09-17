/**
 * The page, not the barber.
 *
 * Every other test in this suite that touches the screen asserts something
 * about The Barber Shop Shrewsbury: their phone number, their prices, the words
 * of their Tuesday post. That is the right thing for the eval, which exists to
 * measure this pipeline against one designed output, and the wrong thing for
 * everything else, because the data is an example. Every customer gets
 * different words and the same page.
 *
 * So these assert what must be true whatever business is in it, and they are
 * run over deliberately hostile dummies: a name with markup in it, a business
 * with nothing on its site, one channel, all six, video only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHANNEL } from '../src/types.ts';
import type { Channel } from '../src/types.ts';
import { renderScreen } from '../src/render.js';
import { write } from '../src/write.js';

const PAGE = join(import.meta.dirname, '..', '..', '..', 'UI', 'workspace.html');
const page = () => readFileSync(PAGE, 'utf8');
const ALL = Object.keys(CHANNEL) as Channel[];

/* ── dummy businesses, none of them a barber ──────────────────────────────── */

const bare = {
  name: 'A Business', readAt: '2026-09-14', pages: ['https://x.test/'],
  channels: [], voiceSample: '', booking: undefined,
  known: { services: [], prices: {}, accreditations: [], awards: [], namedClients: [], counts: {} },
};
const hostile = {
  ...bare,
  name: `<script>alert(1)</script> Smith & Sons "Ltd" <b>`,
  voiceSample: 'We do things & we do them well. "Properly", as my father said. <em>Always.</em>',
  known: { ...bare.known, services: ['a & b', '<i>c</i>'], prices: { 'a & b': '£10' } },
};

function screenFor(channels: Channel[], facts: any = bare, weeksWritten = 1) {
  const posts = channels.map((c, i) => {
    const slot = { channel: c, angle: 'what-it-costs', kind: 'useful', purpose: 'useful',
      date: `2026-09-${15 + i}`, week: i < 2 ? 1 : 2 };
    return slot.week <= weeksWritten ? { ...slot, ...write(slot as any, facts) } : slot;
  });
  return renderScreen({
    business: facts.name, channels, voice: facts.voiceSample || 'Plain words about the work.',
    recommendation: { cadence: 'weekly', because: [{ text: 'You said once a week.' }] },
    posts, weeks: [1, 2, 3, 4].map((w) => ({ week: `Week ${w}`, about: '', channels })),
  } as any, facts as any);
}

/** Every combination worth rendering: each channel alone, all of them, and a pair. */
const COMBOS: Channel[][] = [...ALL.map((c) => [c]), ALL, ['instagram', 'youtube'], ['tiktok', 'youtube']];

/* ── the page holds together whatever is in it ────────────────────────────── */

test('nothing unrendered reaches the screen, for any channel', () => {
  for (const combo of COMBOS) {
    for (const facts of [bare, hostile]) {
      const html = screenFor(combo, facts);
      for (const rot of [/undefined/, /\bNaN\b/, /\[object Object\]/, /\bnull\b/]) {
        assert.doesNotMatch(html, rot, `${rot} in ${combo.join('+')} with ${facts.name.slice(0, 12)}`);
      }
    }
  }
});

test('no empty element is rendered where content was expected', () => {
  for (const combo of COMBOS) {
    const html = screenFor(combo);
    /* An element the page script fills at runtime is empty on purpose, and it
       carries the id the script finds it by. Anything else empty is a hole. */
    const empties = [...html.matchAll(/<(p|h1|h2|h3|span|li|strong)([^>]*)>\s*<\/\1>/g)]
      .filter((m) => !/\sid="/.test(m[2])).map((m) => m[0]);
    assert.deepEqual(empties, [], `empty tag in ${combo.join('+')}`);
    assert.doesNotMatch(html, /<div class="controls"><\/div>/, `empty control bar in ${combo.join('+')}`);
    assert.doesNotMatch(html, /<div class="stats"><\/div>|<ul><\/ul>/, `empty container in ${combo.join('+')}`);
  }
});

test('a business name with markup in it is escaped, never executed', () => {
  const html = screenFor(['instagram'], hostile);
  assert.doesNotMatch(html, /<script/i, 'a script tag from the business name reached the page');
  assert.match(html, /&lt;script&gt;/, 'the angle brackets were not escaped');
  assert.match(html, /Smith &amp; Sons/, 'a bare ampersand was written into the markup');
  assert.match(html, /&quot;Ltd&quot;/, 'a quote survived, which breaks out of any attribute');
  assert.doesNotMatch(html, /<b>/, 'a tag from the business name is live in the markup');
});

test('text off their site cannot break out of an attribute', () => {
  const nasty = { ...bare, name: `X" onmouseover="alert(1)` };
  const html = screenFor(['instagram'], nasty);
  /* The escaped text still contains the letters "onmouseover=", harmlessly.
     What must not appear is the real quote that would end the attribute. */
  assert.doesNotMatch(html, /onmouseover="/, 'an event handler was written into the page');
  assert.doesNotMatch(html, /=\s*"[^"]*"\s+on[a-z]+=/i, 'an attribute was broken out of');
  assert.match(html, /&quot; onmouseover=&quot;/, 'the quotes were not escaped');
});

test('a pound sign survives as a pound sign and is not double-escaped', () => {
  const html = screenFor(['instagram'], { ...bare, known: { ...bare.known, prices: { widget: '£12' } } });
  assert.doesNotMatch(html, /&amp;(pound|amp|quot|lt|gt|#39);/, 'an entity was escaped twice');
});

/**
 * The named sections, in order. CLAUDE.md 3 calls this list the contract.
 *
 * Written out rather than read off a rendered screen on purpose: comparing
 * screens to each other only proves they agree, so deleting a section from the
 * renderer deleted it from every screen and every comparison still passed. That
 * is what happened when this was first written, and it is the same defect as a
 * guard nothing calls: a check that cannot fail.
 */
const SECTIONS = [
  'What you have posted',
  'How often we suggest you post',
  'What you sound like',
  'This week',
  'Resize a photo',
  'The rest of the month',
  'What we did not write',
];
const sectionsOf = (html: string) =>
  [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim());

test('every section in the contract is on the screen, in order', () => {
  assert.deepEqual(sectionsOf(screenFor(['instagram'])), SECTIONS);
});

test('the same sections appear whatever the business and whatever its channels', () => {
  for (const combo of COMBOS) {
    assert.deepEqual(sectionsOf(screenFor(combo, hostile)), SECTIONS, `sections differ for ${combo.join('+')}`);
  }
});

test('every written post carries its whole head and body', () => {
  for (const combo of COMBOS) {
    const html = screenFor(combo, hostile);
    const cards = [...html.matchAll(/<article class="card">([\s\S]*?)<\/article>/g)].map((m) => m[1]);
    assert.ok(cards.length, `no posts at all for ${combo.join('+')}`);
    for (const c of cards) {
      assert.match(c, /class="t-card u-push">[^<]+</, 'a post with no day');
      assert.match(c, /<p class="t-doc">[\s\S]*?\S[\s\S]*?<\/p>/, 'a post with no words');
      assert.match(c, /(Photograph|Film)<\/p><p class="t-row">[^<]{15,}/, 'a post with no instruction');
    }
  }
});

test('a post is never asked for a photograph and a film at once', () => {
  for (const c of ALL) {
    const html = screenFor([c]);
    const kinds = [...html.matchAll(/<p class="t-kind">(Photograph|Film)<\/p>/g)].map((m) => m[1]);
    assert.equal(new Set(kinds).size <= 1, true, `${c} asked for both`);
    assert.equal(kinds[0], CHANNEL[c].medium === 'video' ? 'Film' : 'Photograph', `${c} asked for the wrong one`);
  }
});

test('a business with nothing on its site still gets a whole screen', () => {
  const html = screenFor(['instagram'], bare);
  assert.ok(html.length > 2000, 'the screen collapsed to nothing');
  assert.match(html, /<h2/, 'no sections');
  assert.match(html, /<article class="card">/, 'no posts');
});

/* ── the markup and the script that drives it agree ───────────────────────── */

test('every id the page script reaches for exists in the markup', () => {
  const src = page();
  const asked = [...new Set([...src.matchAll(/\$\('([a-zA-Z0-9_-]+)'\)/g)].map((m) => m[1]))];
  assert.ok(asked.length >= 10, `only found ${asked.length} lookups, the scan is wrong`);
  for (const id of asked) {
    assert.match(src, new RegExp(`id="${id}"`), `the script reads #${id} and nothing defines it`);
  }
});

test('no id is defined twice on the page', () => {
  const ids = [...page().matchAll(/\sid="([a-zA-Z0-9_-]+)"/g)].map((m) => m[1]);
  const seen = new Set<string>(), dupes = new Set<string>();
  for (const id of ids) (seen.has(id) ? dupes : seen).add(id);
  assert.deepEqual([...dupes], [], 'a duplicate id means getElementById returns the wrong one');
});

test('the renderer holds no business in it', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'src', 'render.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /barber|shrewsbury|groom|paw-lished/i, 'an example leaked into the renderer');
  assert.doesNotMatch(code, /\b0\d{3,4}\s?\d{6}\b/, 'a phone number is hardcoded');
  assert.doesNotMatch(code, /£\s?\d/, 'a price is hardcoded');
});
