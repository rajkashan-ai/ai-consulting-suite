/**
 * Knowing where to look, before looking.
 *
 * The failure this prevents is the quiet one: a plumber run using a barber's
 * sources, finding nothing, and rendering an empty competitor list. On the
 * screen that is indistinguishable from a business with no competitors. One is
 * a finding and the other is a bug, and the customer cannot tell which.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFor, ROUTES, coreServiceWords } from '../src/discovery-routes.ts';

test('a barber is platform-led and both platforms are usable', () => {
  const p = planFor('barber');
  assert.equal(p.shape, 'platform-led');
  assert.deepEqual(p.usable.map(u => u.host), ['booksy.com', 'fresha.com']);
  assert.equal(p.cannotProceed, null);
});

test('a plumber is directory-led, and most of those directories refuse us', () => {
  // Measured 15 September: Checkatrade, Yell and 192.com all returned 403.
  const p = planFor('plumber');
  assert.equal(p.shape, 'directory-led');
  assert.deepEqual(p.usable.map(u => u.host), ['trustatrader.com']);
  assert.ok(p.blocked.length >= 2, 'the blocked directories are not recorded');
});

test('an unknown trade stops the run instead of guessing', () => {
  const p = planFor('architect');
  assert.equal(p.shape, 'unknown');
  assert.deepEqual(p.usable, []);
  assert.match(p.cannotProceed ?? '', /we would be guessing/i);
});

test('the reason names the trade, so the message is about this run', () => {
  assert.match(planFor('florist').cannotProceed ?? '', /florists/);
});

test('every route carries the date its access was measured', () => {
  // A 403 can become a 200. A recorded access with no date is a rumour.
  for (const [name, r] of Object.entries(ROUTES)) {
    assert.match(r.checkedOn, /^\d{4}-\d{2}-\d{2}$/, `${name} has no check date`);
    assert.ok(['readable', 'forbidden', 'not-tested'].includes(r.access), `${name} has an odd access value`);
  }
});

test('a route that refuses us promises nothing', () => {
  // A blocked source with a list of what it "gives" invites someone to build on
  // data we cannot get.
  for (const [name, r] of Object.entries(ROUTES)) {
    if (r.access === 'forbidden') assert.deepEqual(r.gives, [], `${name} is blocked but claims to give data`);
  }
});

test('the core job of a trade is written down, not inferred', () => {
  // Three heuristics picked three different wrong anchors: the dearest service
  // compared beard sculpting, the most-shared picked a two-job service and
  // inflated every competitor by £5, and preferring plain ones landed on a
  // beard trim. Which job a trade is judged on is domain knowledge.
  assert.deepEqual(coreServiceWords('barber'), ['cut', 'haircut']);
  assert.ok(coreServiceWords('plumber')?.includes('boiler'));
});

test('an unlisted trade compares nothing rather than the wrong thing', () => {
  assert.equal(coreServiceWords('florist'), null);
});
