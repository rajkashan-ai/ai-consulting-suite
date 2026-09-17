/**
 * Checks the eval set is trustworthy before its score means anything.
 *
 * TESTING.md section 3. A set that grades itself, or that has no held-out
 * cases, produces a number that only measures our own effort.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from '../evals/cases.ts';

test('twenty cases minimum', () => {
  assert.ok(CASES.length >= 20, `${CASES.length} cases`);
});

test('every case has a unique id, an origin and one thing it decides', () => {
  assert.equal(new Set(CASES.map(c => c.id)).size, CASES.length);
  for (const c of CASES) {
    assert.ok(c.origin.length > 6, c.id);
    assert.ok(c.grades.length > 20, c.id);
    assert.ok(!c.grades.includes(' and ') || c.grades.split('.').length > 1, `${c.id} decides two things`);
  }
});

test('some are held back, so a rising score is not just our own tuning', () => {
  assert.ok(CASES.filter(c => c.held).length >= 4);
});

test('most are graded by code, because a judge costs money on every run', () => {
  assert.ok(CASES.filter(c => c.grader.by === 'code').length >= CASES.length / 2);
});

test('every code grader names a function we actually have', () => {
  const known = [
    'findInventedClaims', 'findLocalAssumptions', 'checkShot', 'checkLength',
    'findFeedbackPrompts', 'findBuildDetail', 'findUnlistedGaps', 'findOverwrites',
    'validateShape', 'validateDates', 'no-ai-speak word list',
  ];
  for (const c of CASES) {
    if (c.grader.by !== 'code') continue;
    for (const fn of c.grader.fn.split(', ')) assert.ok(known.includes(fn), `${c.id}: ${fn}`);
  }
});
