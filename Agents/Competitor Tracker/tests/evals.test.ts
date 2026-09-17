/**
 * The eval set has to be trustworthy before its score means anything.
 * These check the set itself. Running it against the model costs money and
 * happens before a prompt ships, not every session. TESTING.md section 3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES, HELD_BACK } from '../evals/cases.ts';

test('at least twenty cases, or the score is noise', () => {
  assert.ok(CASES.length >= 20, `only ${CASES.length} cases`);
});

test('every case decides one thing, and says where it came from', () => {
  for (const c of CASES) {
    assert.ok(c.grades.length > 15, `${c.id}: no clear thing being graded`);
    assert.ok(c.origin.length > 3, `${c.id}: no origin`);
  }
});

test('no duplicate ids, so a case cannot be quietly counted twice', () => {
  assert.equal(new Set(CASES.map(c => c.id)).size, CASES.length);
});

test('some cases are held back and never tuned against', () => {
  assert.ok(HELD_BACK.length >= 5, 'too few held-back cases to detect over-fitting');
});

test('a judged case asks one arguable question, not "is this good"', () => {
  for (const c of CASES) {
    if (c.grader.by !== 'judge') continue;
    assert.match(c.grader.question, /\?$/, `${c.id}: not a question`);
    assert.doesNotMatch(c.grader.question, /\bgood\b|\bquality\b|\bbetter\b/i,
      `${c.id}: "${c.grader.question}" cannot be argued with`);
  }
});

test('anything a plain check can grade is graded by code, not by a judge', () => {
  const byCode = CASES.filter(c => c.grader.by === 'code');
  assert.ok(byCode.length >= 8, 'too much is being sent to a paid judge');
});

test('the real failures we have already hit are all in the set', () => {
  const mustExist = ['checkatrade-403', 'meta-ad-library-empty', 'domain-does-not-resolve', 'barber-instagram-hole'];
  for (const id of mustExist) assert.ok(CASES.some(c => c.id === id), `lost the case for ${id}`);
});
