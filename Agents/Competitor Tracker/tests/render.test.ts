/**
 * The renderer, and specifically what it does with what it does not know.
 *
 * A screen that quietly drops the fields a run could not read is how a partial
 * run looks finished. Every test here is about the gap being visible, in the
 * slot the value would have filled.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderTracker, unread } from '../src/render.ts';

const base = () => ({
  profile: { name: 'The Barber Shop Shrewsbury', trade: 'barber', town: 'Shrewsbury',
             country: 'GB', services: [], website: 'https://www.shrewsburybarber.co.uk' },
  services: [{ name: 'Classic Cut', price: 15 }],
  readOn: '2026-09-15', sourceUrl: 'https://shrewsburybarber.co.uk/', nextCheck: 'Runs once a week',
  reviewsAboutYou: 0, reviewsAcrossTheFive: 4799, searchesAppearedIn: '2 of 3',
  ownHeadlinePrice: 15, medianOfTheFive: 20,
  competitors: [{ name: 'HINCES', headlinePrice: 35, where: 'Booksy', source: 'booksy.com' }],
  ahead: [{ text: 'You publish a full menu' }], behind: [{ text: 'They have reviews' }],
  actions: [{ area: 'Channels', headline: 'Get listed', why: 'Because' }],
  checked: [{ what: 'Their site', note: 'name and address' }],
  notChecked: [{ what: 'Google', note: 'readable, not storable' }],
});

test('the five bands of the real screen are all present, in order', () => {
  const h = renderTracker(base() as any);
  const order = ['band--first', 'band--b', 'The five, side by side', 'band--dark', 'band--last'];
  let at = -1;
  for (const marker of order) {
    const i = h.indexOf(marker);
    assert.ok(i > at, `${marker} is missing or out of order`);
    at = i;
  }
});

test('an unread figure shows a dash and says why, in the tile it would have filled', () => {
  const v = base() as any;
  v.reviewsAboutYou = unread('No review source has been read yet');
  const h = renderTracker(v);
  assert.match(h, /&mdash;/);
  assert.match(h, /No review source has been read yet/);
  // and it must not silently become a zero, which reads as a finding
  assert.doesNotMatch(h, /stat__figure">0</);
});

test('a competitor we could not read is a row, never a missing row', () => {
  const v = base() as any;
  v.competitors = [unread('Discovery is not built yet')];
  const h = renderTracker(v);
  assert.match(h, /Not read/);
  assert.match(h, /Discovery is not built yet/);
});

test('with no actions it says so in the actions band rather than showing an empty one', () => {
  const v = base() as any;
  v.actions = [unread('An action has to rest on a number above')];
  const h = renderTracker(v);
  assert.match(h, /No action can be written yet/);
  assert.match(h, /An action has to rest on a number above/);
});

test('with nothing to say, the Ahead and Behind columns say that', () => {
  const v = base() as any;
  v.ahead = []; v.behind = [];
  const h = renderTracker(v);
  assert.equal((h.match(/Nothing can be said yet/g) ?? []).length, 2);
});

test('a business name is escaped, because names come off the open web', () => {
  const v = base() as any;
  v.competitors = [{ name: 'Cut & Shave <script>alert(1)</script>', headlinePrice: 20 }];
  const h = renderTracker(v);
  assert.doesNotMatch(h, /<script>alert/);
  assert.match(h, /Cut &amp; Shave/);
});

test('it uses only classes the stylesheet already has', () => {
  // No new design per tool: if a class is not in app.css, it does not belong
  // in a renderer either.
  const h = renderTracker(base() as any);
  const used = [...h.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean);
  const css = readCss();
  const missing = [...new Set(used)].filter(c => !css.includes('.' + c));
  assert.deepEqual(missing, [], `classes not in app.css: ${missing.join(', ')}`);
});

/** `require` is not defined in an ES module, so the first version of this threw
 *  rather than asserting and the failure looked like a class problem. */
function readCss(): string {
  return readFileSync(join(import.meta.dirname, '..', '..', '..', 'UI', 'app.css'), 'utf8');
}
