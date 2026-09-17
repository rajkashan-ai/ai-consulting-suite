/**
 * Once a week, never more. CLAUDE.md section 2a.
 * The cost control, the honesty control, and the thing that makes "what changed" mean anything.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideRun, nextRunAt, changingTheListTriggers, WEEK_MS } from '../src/freshness.ts';

const MONDAY = '2026-09-14T08:02:00.000Z';
const at = (ms: number) => new Date(new Date(MONDAY).getTime() + ms);
const DAY = 24 * 60 * 60 * 1000;

test('a business that has never run gets a fresh run', () => {
  assert.equal(decideRun(null, at(0)).allowed, true);
});

test('every day inside the week is refused', () => {
  for (let day = 0; day < 7; day++) {
    const d = decideRun(MONDAY, at(day * DAY));
    assert.equal(d.allowed, false, `day ${day} allowed a fresh run`);
    if (!d.allowed) assert.equal(d.reason, 'within-the-week');
  }
});

test('one second before the week is up is still refused', () => {
  assert.equal(decideRun(MONDAY, at(WEEK_MS - 1000)).allowed, false);
});

test('exactly seven days is allowed', () => {
  assert.equal(decideRun(MONDAY, at(WEEK_MS)).allowed, true);
});

test('and any time after', () => {
  assert.equal(decideRun(MONDAY, at(WEEK_MS + DAY * 30)).allowed, true);
});

test('a clock that has gone backwards does not buy a run', () => {
  const d = decideRun(MONDAY, at(-DAY));
  assert.equal(d.allowed, false);
  if (!d.allowed) assert.equal(d.reason, 'clock-went-backwards');
});

test('the refusal always says when the next run is, because the screen shows it', () => {
  const d = decideRun(MONDAY, at(DAY));
  assert.equal(d.allowed, false);
  if (!d.allowed) assert.equal(d.nextRunAt, nextRunAt(MONDAY));
});

test('the week is seven times twenty-four hours, so a clock change cannot shift it', () => {
  // 25 October 2026, the UK clocks go back. Seven days is still seven days.
  const beforeDst = '2026-10-24T23:30:00.000Z';
  assert.equal(new Date(nextRunAt(beforeDst)).getTime() - new Date(beforeDst).getTime(), WEEK_MS);
});

test('adding a competitor rebuilds the table and the actions from stored data', () => {
  const t = changingTheListTriggers(MONDAY, at(DAY));
  assert.equal(t.recomputeFromStored, true);
});

test('but adding a competitor inside the week does not buy a trip to the web', () => {
  // Otherwise the weekly cap is bypassed by typing a name, and the cost control is gone.
  assert.equal(changingTheListTriggers(MONDAY, at(DAY)).fetchFreshFromWeb, false);
});

test('adding one after the week is up does fetch', () => {
  assert.equal(changingTheListTriggers(MONDAY, at(WEEK_MS + 60_000)).fetchFreshFromWeb, true);
});
