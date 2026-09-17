/**
 * Checking a competitor the customer named, before it takes one of the five.
 *
 * The list is capped and their picks are permanent, so a name we can find
 * nothing about does not make an empty row: it evicts a competitor we could
 * read and replaces it with blanks, every week, for ever.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, say, costOfKeeping, type Found } from '../src/candidate.ts';
import { MAX_COMPETITORS } from '../src/competitor-set.ts';

const SRC = [{ url: 'https://booksy.com/en-gb/x', fetchedOn: '2026-09-15' }];
const LOOKED = ['Booksy', 'Fresha', 'their own website', 'the web'];
const found = (name: string, where: string | null): Found => ({ name, where, sources: SRC });

test('one clear match is confirmed, never assumed', () => {
  const r = check('Headcase Barbers', [found('Headcase Barbers', "St Mary's Street, Shrewsbury")], LOOKED);
  assert.equal(r.status, 'confirm');
  const s = say(r);
  assert.match(s.title, /^Is this the right/);
  assert.match(s.detail, /St Mary's Street/);
});

/**
 * "The Fade Inn" matched an account with 9,065 followers that turned out to be
 * a barber on Hollywood Boulevard. The tool carried that number on the wrong
 * business for two days. Two matches must never be silently resolved to one.
 */
test('two businesses of the same name are never guessed between', () => {
  const r = check('The Fade Inn', [
    found('The Fade Inn', 'Longdon Coleham, Shrewsbury'),
    found('The Fade Inn', 'Hollywood Blvd, Los Angeles'),
  ], LOOKED);
  assert.equal(r.status, 'which-one');
  assert.equal(say(r).canKeep, false, 'offered to keep one without the customer choosing');
});

test('finding nothing says where we looked, and is not an error', () => {
  const r = check("Bob's Barbers", [], LOOKED);
  assert.equal(r.status, 'nothing-found');
  const s = say(r);
  assert.match(s.detail, /Booksy, Fresha, their own website, the web/);
  assert.equal(s.canKeep, true, 'the customer knows their own trade better than we do');
});

test('the empty row is promised out loud, not discovered next Monday', () => {
  assert.match(say(check('X', [], LOOKED)).detail, /stay empty until something appears/);
});

/** Not being able to look is a different thing from looking and finding nothing. */
test('a failed check is never reported as "nothing found"', () => {
  const r = check('Someone', [], LOOKED, 'Booksy did not answer');
  assert.equal(r.status, 'could-not-check');
  assert.match(say(r).detail, /Booksy did not answer/);
  assert.match(say(r).detail, /check on the next run/);
});

test('a match with no address says so rather than implying one', () => {
  const s = say(check('Legion Barbers', [found('Legion Barbers', null)], LOOKED));
  assert.match(s.detail, /nothing that says where they are/);
});

test('a hit with no source behind it does not count as found', () => {
  const r = check('Ghost Barbers', [{ name: 'Ghost Barbers', where: 'somewhere', sources: [] }], LOOKED);
  assert.equal(r.status, 'nothing-found');
});

/* ── The cost of keeping one ──────────────────────────────────────────────── */

test('at five, the price of adding is stated before it is paid', () => {
  const c = costOfKeeping(MAX_COMPETITORS, MAX_COMPETITORS);
  assert.ok(c);
  assert.match(c!, /replaces one of them/);
  assert.match(c!, /empty is what you will see/);
});

test('below five there is nothing to warn about', () => {
  assert.equal(costOfKeeping(3, MAX_COMPETITORS), null);
});

test('every outcome gives the screen a title, a detail and a decision', () => {
  // Real names, because a one-letter name makes a shorter sentence than any
  // real one and would pass a length check the product never sees.
  const all = [
    check('Legion Barbers', [found('Legion Barbers', 'Battlefield Road, Shrewsbury')], LOOKED),
    check('The Fade Inn', [found('The Fade Inn', 'Shrewsbury'), found('The Fade Inn', 'Los Angeles')], LOOKED),
    check("Bob's Barbers", [], LOOKED),
    check('Mobile Barber Shropshire', [], LOOKED, 'Booksy did not answer'),
  ];
  for (const r of all) {
    const s = say(r);
    assert.ok(s.title.length > 10, r.status);
    assert.ok(s.detail.length > 20, r.status);
    assert.equal(typeof s.canKeep, 'boolean', r.status);
  }
});
