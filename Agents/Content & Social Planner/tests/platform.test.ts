/**
 * The register of other people's facts, and whether it has gone off.
 *
 * These numbers do not vary by customer, which is why they are stored rather
 * than worked out per run. They do vary by date, which is why storing them
 * without a date would be worse than not storing them: a number on a customer's
 * screen with no source and no expiry is exactly the claim CLAUDE.md 1 forbids.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { everyFact, unverified, stale, IMAGE_SIZES, CAPS, TITLES, CONNECT, STALE_AFTER_DAYS } from '../src/platform.ts';
import { CHANNEL } from '../src/types.ts';
import type { Channel } from '../src/types.ts';

const read = (...p: string[]) => readFileSync(join(import.meta.dirname, '..', ...p), 'utf8');

test('every fact declares where it came from', () => {
  for (const { name, fact } of everyFact()) {
    assert.ok(fact.source && fact.source.length > 10, `${name} has no source`);
  }
});

test('a fact with no date says why, rather than looking checked', () => {
  for (const { name, fact } of everyFact()) {
    if (fact.checked === null) {
      assert.ok(fact.why && fact.why.length > 20, `${name} is unverified and does not say so`);
    } else {
      assert.match(fact.checked, /^\d{4}-\d{2}-\d{2}$/, `${name} has a date in no readable form`);
      assert.ok(+new Date(fact.checked) <= Date.now() + 86400000, `${name} is dated in the future`);
    }
  }
});

test('nothing dated has gone stale', () => {
  const old = stale();
  assert.deepEqual(old, [],
    `re-check these and update the date, they are over ${STALE_AFTER_DAYS} days old:\n  ` +
    old.map((x) => `${x.name} (${x.age} days)`).join('\n  '));
});

test('the unverified ones are exactly the four we know about', () => {
  assert.deepEqual(unverified().sort(),
    ['caps.facebook', 'caps.google-business', 'caps.instagram', 'caps.linkedin'],
    'either a new unverified fact appeared, or one was verified and this list was not updated');
});

test('the staleness gate can actually go red', () => {
  const future = new Date('2030-01-01');
  assert.ok(stale(90, future).length >= 15, 'nothing goes stale even six years on, so this gate is decoration');
});

/* ── the register is the only copy ────────────────────────────────────────── */

test('the channel caps on screen come from the register, not a second list', () => {
  for (const c of Object.keys(CHANNEL) as Channel[]) {
    assert.equal(CHANNEL[c].capChars, (CAPS as any)[c].value, `${c} cap has drifted from the register`);
  }
  assert.equal(CHANNEL.youtube.titleChars, TITLES.youtube.value);
});

/** Source with the comments taken out. A comment explaining why a number moved
    out of a file is not the number being back in it. */
const code = (...p: string[]) =>
  read(...p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('no consumer keeps its own copy of a platform number', () => {
  const types = code('src', 'types.ts');
  assert.doesNotMatch(types.slice(types.indexOf('export const CHANNEL')), /capChars:\s*\d/,
    'a character cap is written out in types.ts again');
  assert.doesNotMatch(code('src', 'extract.js'), /\['instagram',\s*\//,
    'the URL shapes are hardcoded in extract.js again');
  assert.doesNotMatch(code('src', 'render.js'), /joined to a Facebook page/,
    'the Meta connect prose is written out in render.js again');
});

test('the resizer offers exactly the sizes in the register', () => {
  const page = read('..', '..', 'UI', 'workspace.html');
  const at = page.indexOf('FORMATS = [');
  const body = page.slice(at, page.indexOf('];', at));
  const onPage = [...body.matchAll(/\{id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*w:\s*(\d+),\s*h:\s*(\d+),\s*who:\s*'([^']*)'/g)]
    .map((m) => ({ id: m[1], name: m[2], w: +m[3], h: +m[4], who: m[5] }));
  assert.deepEqual(onPage, IMAGE_SIZES.map((s) => ({ id: s.value.id, name: s.value.name, w: s.value.w, h: s.value.h, who: s.value.who })),
    'the page and the register disagree about the image sizes');
});

test('the Meta connect wording is only shown for Meta', () => {
  assert.match(CONNECT.meta.value, /Facebook page/);
  assert.doesNotMatch(CONNECT.none.value, /Facebook page|business or creator/,
    'the fallback repeats Meta rules for channels they do not apply to');
});

test('what a customer supplies is not in the register', () => {
  const src = read('src', 'platform.ts');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\*.*$/gm, '');
  for (const leak of [/barber/i, /shrewsbury/i, /paw-lished/i, /£\s?\d/, /\b0\d{3,4}\s?\d{6}\b/]) {
    assert.doesNotMatch(code, leak, 'a customer fact is stored as if it were a platform fact');
  }
});
