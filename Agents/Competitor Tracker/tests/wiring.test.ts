/**
 * Is it plugged in, and is it covered? Two different questions.
 *
 * 15 September. `findRankClaims` was exported, documented as "the guard"
 * against claiming a Google position, and referenced by five tests. It was
 * missing from `validateBattlecard`, so it never ran on a battlecard. Every one
 * of its tests passed the whole time, because they called it directly.
 *
 * The Content & Social Planner ran the same audit on its own source and found
 * four more of these, two of them written that morning. It also found the case
 * this file did not originally cover: a guard that IS wired and has no test at
 * all. Wiring and coverage are separate claims and each needs its own
 * assertion, so there is one here for each.
 *
 * These read source text rather than behaviour on purpose. A behavioural test
 * only fails if the fixture happens to trigger the missing branch; reading the
 * source fails whenever the wiring is absent, which is the point.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const TESTS = join(ROOT, 'tests');

const srcFiles = readdirSync(SRC).filter(f => f.endsWith('.ts'));
const testFiles = readdirSync(TESTS).filter(f => f.endsWith('.test.ts'));

// Read the directory, never a hard-coded list. A list of files has to be edited
// every time one is added and nothing fails when you forget — the same defect
// design-rules.md records for a breakpoint rule that names the children it
// moves. This file would be exempting itself from its own lesson otherwise.
const src = Object.fromEntries(srcFiles.map(f => [f, readFileSync(join(SRC, f), 'utf8')]));
const tests = Object.fromEntries(testFiles.map(f => [f, readFileSync(join(TESTS, f), 'utf8')]));

const mentions = (text: string, name: string) => new RegExp(`\\b${name}\\b`).test(text);

/**
 * One pattern, used everywhere in this file, so a form that is invisible here is
 * invisible consistently rather than in three different ways.
 *
 * `async` was missing until 15 September, and the Content & Social Planner found
 * it in their copy of this gate the moment they wrote their first async
 * function. `src/ad-library.ts` already had one: `probeCommercialCoverage` was
 * exported, wired and tested, and every assertion below had been silently
 * skipping it. It was fine, but the gate was not telling anyone that.
 */
const EXPORT = String.raw`export\s+(?:async\s+)?(?:function\*?|const|class)\s+`;

const exportsOf = (file: string): string[] =>
  [...src[file].matchAll(new RegExp(`^${EXPORT}([A-Za-z0-9_]+)`, 'gm'))].map(m => m[1]);

const GUARDS = exportsOf('guards.ts').filter(n => n.startsWith('find') || n === 'validateActions');

/* ── 1. Wired: every guard is called by the gate ──────────────────────────── */

test('every guard is called by validateBattlecard', () => {
  assert.ok(GUARDS.length >= 10, `only ${GUARDS.length} guards found; the regex has drifted`);
  const at = src['guards.ts'].search(new RegExp(`^${EXPORT}validateBattlecard\\b`, 'm'));
  assert.notEqual(at, -1, 'validateBattlecard is not where this test expects it');
  const gate = src['guards.ts'].slice(at);
  const unwired = GUARDS.filter(g => !gate.includes(`${g}(`));
  assert.deepEqual(unwired, [],
    `exported, tested, and called by nothing: ${unwired.join(', ')}. ` +
    'A guard that is not called does not guard anything, however well tested it is.');
});

/* ── 2. Covered: and every guard has a test of its own ────────────────────── */

test('and every guard is exercised by a test outside this file', () => {
  // The gap this file missed until the Planner pointed it out. A guard can be
  // correctly wired and have no test at all; test 1 passes it, because it IS in
  // the aggregator. Only this assertion separates the two.
  const untested = GUARDS.filter(g =>
    !testFiles.some(t => t !== 'wiring.test.ts' && mentions(tests[t], g)));
  assert.deepEqual(untested, [],
    `wired into the gate and never tested: ${untested.join(', ')}. ` +
    'Wiring a guard and covering it are two different jobs.');
});

/* ── 3. No orphans anywhere else in src ───────────────────────────────────── */

test('no export is both uncalled and untested', () => {
  // This is the generalised catcher. validateBattlecard itself was invisible to
  // every other check: never called in src, never referenced by a test, and it
  // appeared exactly once in the whole repo. Most exports here are deliberate
  // entry points that no other module calls, which is why the bar is "called
  // OR tested" rather than "called".
  const orphans: string[] = [];
  for (const file of srcFiles) {
    for (const name of exportsOf(file)) {
      const ownDefinition = new RegExp(`^${EXPORT}${name}\\b.*$`, 'm');
      const calledInSrc = srcFiles.some(other => other === file
        ? mentions(src[other].replace(ownDefinition, ''), name)
        : mentions(src[other], name));
      const covered = testFiles.some(t => mentions(tests[t], name));
      if (!calledInSrc && !covered) orphans.push(`${file}:${name}`);
    }
  }
  assert.deepEqual(orphans, [],
    `dead or forgotten: ${orphans.join(', ')}. Wire it, test it, or delete it.`);
});

test('the guard list this file checks is not empty or silently narrowed', () => {
  // If the export regex stops matching, tests 1 and 2 pass vacuously over an
  // empty list and report nothing. Assert the shape of the list itself.
  assert.ok(GUARDS.includes('findRankClaims'), 'the guard that started this is not in the list');
  assert.ok(GUARDS.includes('validateActions'));
  assert.equal(new Set(GUARDS).size, GUARDS.length, 'duplicate names in the guard list');
});

test('the export pattern sees every form, including async', () => {
  // Asserted directly rather than by mutation. There is no ORPHANED async
  // export to break, so neutering this fix reports 0 red — which reads as "the
  // fix does nothing" when it actually means "nothing needs it yet". A correct
  // mutation of a defensive fix is the third way a breakage run can mislead;
  // TESTING.md carries the other two.
  const re = new RegExp(`^${EXPORT}([A-Za-z0-9_]+)`, 'gm');
  const sample = [
    'export function findA() {}',
    'export async function findB() {}',
    'export const C = 1;',
    'export class D {}',
    'export function* E() {}',
  ].join('\n');
  assert.deepEqual([...sample.matchAll(re)].map(m => m[1]), ['findA', 'findB', 'C', 'D', 'E']);
});

test('and the real async export in src is now visible to this gate', () => {
  // probeCommercialCoverage is the one that was being skipped.
  assert.ok(exportsOf('ad-library.ts').includes('probeCommercialCoverage'),
    'the async export is still invisible, so the pattern fix did not take');
});
