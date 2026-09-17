/**
 * One channel list, not several.
 *
 * `recommend.ts` kept its own hand-written copy of the channel names. Adding
 * TikTok and YouTube left it stale, and the recommendation read "Split across
 * Instagram, Facebook,  and undefined" on a customer screen. Nothing caught it,
 * because node runs the TypeScript without typechecking it, so a Record missing
 * two keys is a runtime undefined rather than a build error.
 *
 * These tests are over every channel in CHANNEL, so the next one added cannot
 * repeat it without turning one of them red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANNEL, CADENCE_LABEL } from '../src/types.ts';
import type { Channel } from '../src/types.ts';
import { recommendCadence } from '../src/recommend.ts';

const ALL = Object.keys(CHANNEL) as Channel[];
const known = { services: ['clipper cut', 'beard trim'], prices: { 'clipper cut': '£8' }, accreditations: [], awards: [], namedClients: [], counts: {} };

test('every channel has a name in prose, on its own and in a list', () => {
  for (const c of ALL) {
    const alone = recommendCadence(known as any, { hoursAWeek: 2 }, [c]);
    const line = alone.because.map((r) => r.text).join(' ');
    assert.doesNotMatch(line, /undefined/, `${c} has no prose name`);
    assert.match(line, new RegExp(c === 'google-business' ? 'Google Business Profile' : CHANNEL[c].label), `${c} is not named`);
  }
});

test('all of them together read as a sentence, with no gap and no undefined', () => {
  const r = recommendCadence(known as any, { hoursAWeek: 2 }, ALL);
  const split = r.because.find((x) => /Split across/.test(x.text))!;
  assert.ok(split, 'no channel line at all');
  assert.doesNotMatch(split.text, /undefined/);
  assert.doesNotMatch(split.text, /,\s{2,}|,\s+and\s+and/, 'a name is missing from the list');
  for (const c of ALL) {
    const name = c === 'google-business' ? 'Google Business Profile' : CHANNEL[c].label;
    assert.ok(split.text.includes(name), `${name} is not in the list`);
  }
});

test('what they have to supply matches the channels they are on', () => {
  const photo = recommendCadence(known as any, { hoursAWeek: 2 }, ['instagram', 'facebook']);
  const video = recommendCadence(known as any, { hoursAWeek: 2 }, ['tiktok', 'youtube']);
  const both = recommendCadence(known as any, { hoursAWeek: 2 }, ['instagram', 'tiktok']);
  const cost = (r: any) => r.because.find((x: any) => /over the next 30 days/.test(x.text)).text;

  assert.match(cost(photo), /photographs over/);
  assert.match(cost(video), /clips over/);
  assert.doesNotMatch(cost(video), /photograph/, 'told to photograph for a video-only plan');
  assert.match(cost(both), /photographs or clips over/);
});

test('the step up says the same thing as the cadence line', () => {
  for (const chs of [['instagram'], ['tiktok'], ['instagram', 'youtube']] as Channel[][]) {
    const r = recommendCadence(known as any, { hoursAWeek: 2 }, chs);
    if (!r.stepUp) continue;
    const video = chs.some((c) => CHANNEL[c].medium === 'video');
    const photo = chs.some((c) => CHANNEL[c].medium === 'photo');
    if (video && !photo) assert.doesNotMatch(r.stepUp.costs, /photograph/, `${chs} step up asks for photographs`);
    if (photo && !video) assert.doesNotMatch(r.stepUp.costs, /clip/, `${chs} step up asks for clips`);
    assert.doesNotMatch(r.stepUp.costs, /undefined/);
  }
});
