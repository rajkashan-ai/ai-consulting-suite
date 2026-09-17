/**
 * "Ensure solid learnings do not have to be repeated. Do not regress."
 * Raj, 15 September. Four failures, one test each, and all four made to fail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Learning } from '../src/types.ts';
import {
  A_PATTERN_IS, alreadyKnown, classifyDiff, findRegressions, findRepeatedLearnings,
  findUnappliedLearnings, findUnevidencedLearnings, learnFromDiffs, live, validateLearnings,
} from '../src/learning.ts';

const d = (date: string, ours: string, theirs: string) => ({ date, ours, theirs });
const CUT_THE_LINE = [
  d('2026-09-15', 'A classic cut is scissors on top.\nBook in on NearCut.', 'A classic cut is scissors on top.'),
  d('2026-09-18', 'Our prices, so nobody has to ask.\nPop in any day.', 'Our prices, so nobody has to ask.'),
  d('2026-09-22', 'Beard sculpting is not a trim.\nCall us to book.', 'Beard sculpting is not a trim.'),
];
const learned = () => learnFromDiffs(CUT_THE_LINE, '2026-09-29');

test('a learning comes from what they published, not from how it did', () => {
  const [l] = learned();
  assert.equal(l.from, 'caption-diff');
  assert.equal(l.evidence.length, 3);
  // No metric is involved anywhere in this path, and none is needed.
  assert.ok(!JSON.stringify(l).match(/reach|like|save|comment/i));
});

test('three is a habit, two is a coincidence', () => {
  assert.equal(A_PATTERN_IS, 3);
  assert.equal(learnFromDiffs(CUT_THE_LINE.slice(0, 2), '2026-09-29').length, 0);
  assert.equal(learned().length, 1);
});

test('an unchanged caption teaches nothing', () => {
  assert.equal(classifyDiff(d('x', 'same words', 'same words')), 'unchanged');
  assert.equal(learnFromDiffs([d('x', 'same', 'same'), d('y', 'same', 'same'), d('z', 'same', 'same')], 'n').length, 0);
});

/* ── 1. Every live learning reaches the writer ────────────────────────────── */

test('a learning that never reaches the writing instruction is caught', () => {
  const L = learned();
  assert.equal(findUnappliedLearnings(L, 'Write in their voice.').length, 1);
  assert.deepEqual(findUnappliedLearnings(L, `Write in their voice. ${L[0].rule}`), []);
});

test('a retired learning is not required, and is not deleted either', () => {
  const L = learned().map(l => ({ ...l, retiredOn: '2026-11-01', retiredBecause: 'They asked for sign-offs back.' }));
  assert.deepEqual(findUnappliedLearnings(L, 'Write in their voice.'), []);
  assert.equal(live(L).length, 0);
  assert.equal(L.length, 1, 'the record of it was thrown away');
});

/* ── 2. Learning the same thing twice means the first one never landed ────── */

test('the same rule learned twice is a failure, not a tidy-up', () => {
  const L = learned();
  const twice = [...L, { ...L[0], id: 'diff-cut-the-last-line-2', learnedOn: '2026-10-27' }];
  assert.equal(findRepeatedLearnings(twice).length, 1);
  assert.deepEqual(findRepeatedLearnings(L), []);
});

test('the same rule punctuated differently still counts as the same', () => {
  const L = learned();
  const twice = [...L, { ...L[0], id: 'x', rule: L[0].rule.toUpperCase().replace(/\./g, '!') }];
  assert.equal(findRepeatedLearnings(twice).length, 1);
});

/* ── 3. Nothing disappears without a decision ─────────────────────────────── */

test('a learning that vanishes is a regression', () => {
  assert.deepEqual(findRegressions(learned(), []).map(r => r.kind), ['vanished']);
});

test('a rule quietly rewritten is a regression', () => {
  const before = learned();
  const after = [{ ...before[0], rule: 'Write a closing line.' }];
  assert.ok(findRegressions(before, after).some(r => r.kind === 'rule-rewritten'));
});

test('evidence taken away is a regression, even when the rule survives', () => {
  const before = learned();
  const after = [{ ...before[0], evidence: [before[0].evidence[0]] }];
  assert.ok(findRegressions(before, after).some(r => r.kind === 'evidence-removed'));
});

test('retiring one without saying why is a regression', () => {
  const before = learned();
  const after = [{ ...before[0], retiredOn: '2026-11-01' }];
  assert.ok(findRegressions(before, after).some(r => r.kind === 'retired-without-a-reason'));
});

test('retiring one properly is not', () => {
  const before = learned();
  const after = [{ ...before[0], retiredOn: '2026-11-01', retiredBecause: 'They asked for it back on 1 November.' }];
  assert.deepEqual(findRegressions(before, after), []);
});

test('nothing changing is never a regression', () => {
  const L = learned();
  assert.deepEqual(findRegressions(L, L), []);
});

/* ── 4. Never ask for something we were already told ──────────────────────── */

test('a question we already know the answer to is caught', () => {
  assert.ok(alreadyKnown(learned(), 'Should we write a closing line for you?'));
});

test('an unrelated question is still asked', () => {
  assert.equal(alreadyKnown(learned(), 'What is your postcode?'), null);
  assert.equal(alreadyKnown(learned(), ''), null);
});

test('a retired learning stops suppressing the question', () => {
  const L = learned().map(l => ({ ...l, retiredOn: '2026-11-01', retiredBecause: 'they changed their mind' }));
  assert.equal(alreadyKnown(L, 'Should we write a closing line for you?'), null);
});

/* ── Evidence ─────────────────────────────────────────────────────────────── */

test('a learning with nothing under it is a preference we invented', () => {
  const bad: Learning = { id: 'x', learnedOn: '2026-10-01', from: 'edited', rule: 'Be punchier.', evidence: [] };
  assert.equal(findUnevidencedLearnings([bad]).length, 1);
  assert.equal(findUnevidencedLearnings([{ ...bad, evidence: ['  '] }]).length, 1);
  assert.deepEqual(findUnevidencedLearnings(learned()), []);
});

test('one pass over the store', () => {
  const L = learned();
  const r = validateLearnings(L, `Write in their voice. ${L[0].rule}`);
  assert.deepEqual([r.unapplied.length, r.repeated.length, r.unevidenced.length, r.liveCount], [0, 0, 0, 1]);
});
