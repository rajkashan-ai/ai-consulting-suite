/** The critique loop. CLAUDE.md 5. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Critique } from '../src/types.ts';
import { applyCritique, checkRewriteCalls, describeRewrite, findOverwrites, rewriteSet, voiceNoteAsText } from '../src/voice.ts';
import { PLAN, planWith } from './fixtures/businesses.ts';

const salesy: Critique = { kind: 'too-salesy', postDate: '2026-09-18' };

test('a critique goes into the voice note, which is what outlives the month', () => {
  const note = applyCritique({ read: 'Short, flat, a bit dry.', corrections: [] }, salesy);
  assert.equal(note.corrections.length, 1);
  assert.match(voiceNoteAsText(note), /Too salesy/);
});

test('their own words go in verbatim', () => {
  const note = applyCritique({ read: 'x', corrections: [] },
    { ...salesy, inTheirWords: 'I would never say "get in touch today"' });
  assert.match(voiceNoteAsText(note), /I would never say "get in touch today"/);
});

test('a rewrite touches this post and the ones after it, never the ones before', () => {
  const set = rewriteSet(PLAN, salesy);
  assert.equal(set.length, 8);
  assert.ok(set.every(p => p.date >= '2026-09-18'));
});

test('a post the owner edited is never overwritten', () => {
  const edited = planWith([{}, {}, { editedByOwner: true }]);
  assert.ok(!rewriteSet(edited, salesy).some(p => p.date === '2026-09-22'));
});

test('a post the owner approved is never overwritten', () => {
  const approved = planWith([{}, {}, {}, { approved: true }]);
  assert.ok(!rewriteSet(approved, salesy).some(p => p.date === '2026-09-25'));
});

test('it says how many it will change before it changes them', () => {
  const plan = planWith([{}, {}, { editedByOwner: true }, {}, { approved: true }]);
  const d = describeRewrite(plan, salesy);
  assert.equal(d.willRewrite, 6);
  assert.equal(d.keptBecauseEdited, 1);
  assert.equal(d.keptBecauseApproved, 1);
  assert.match(d.sentence, /rewrite 6 of the 9 posts/);
  assert.match(d.sentence, /1 you have edited/);
});

test('when there is nothing left to rewrite it says so rather than saying nought', () => {
  const all = planWith(Array(9).fill({ approved: true as const }));
  assert.match(describeRewrite(all, salesy).sentence, /nothing left to rewrite/);
});

test('an overwrite of the owner\'s words is caught', () => {
  const before = planWith([{}, { editedByOwner: true }]);
  const after = planWith([{}, { editedByOwner: true, words: 'Something we wrote instead.' }]);
  assert.equal(findOverwrites(before, after).length, 1);
  assert.deepEqual(findOverwrites(before, before), []);
});

test('dropping an edited post altogether is caught too', () => {
  const before = planWith([{}, { editedByOwner: true }]);
  const after = { ...before, posts: before.posts.filter(p => p.date !== '2026-09-18') };
  assert.equal(findOverwrites(before, after)[0].now, '(the post is gone)');
});

test('one critique is one call, never one call per post', () => {
  // The draft rewrote every later post on every click. At `most days` that is
  // twenty-two rewrites nobody asked for, on a flat price.
  //
  // This takes the calls the run actually made. The version it replaces
  // returned `critiques.length === 0 ? 0 : 1` and reported the intention back
  // to itself, so it read as green whatever the runtime did.
  assert.deepEqual(checkRewriteCalls(salesy, 1), []);
  assert.deepEqual(checkRewriteCalls(salesy, 22), [
    { kind: 'one-call-per-post', critique: 'too-salesy', callsMade: 22 },
  ]);
  assert.equal(checkRewriteCalls(salesy, 0)[0].kind, 'nothing-ran');
});
