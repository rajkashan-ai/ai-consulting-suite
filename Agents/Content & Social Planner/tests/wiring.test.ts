/**
 * Every guard is plugged in.
 *
 * The Competitor Tracker found `findRankClaims` on 15 September: written,
 * documented as the guard against claiming a Google rank, covered by five
 * passing unit tests, and called by nothing. It had been missing from the
 * aggregator the whole time.
 *
 * **A unit test proves a guard works. It cannot prove the guard runs.** So this
 * reads the source and asserts that every exported guard appears inside an
 * aggregator, which catches the next unwired one rather than only this one.
 *
 * The same audit over this tool found two, both written that morning:
 * `findOverdueLanguage` and `findPastOccasions`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = (f: string) => readFileSync(join(import.meta.dirname, '..', 'src', f), 'utf8');

/** A guard finds or checks something and returns what it found. */
const GUARD = /^export (?:async )?function ((?:find|check)\w+)/gm;

/**
 * Guards that run on an action rather than over a document, so no document gate
 * can hold them. Each one still has to be on ENTRY_POINTS, which means the
 * "covered by a test" rule below still applies to it.
 *
 * The list is deliberately tiny and each entry says when it fires. If it grows
 * past a handful, the gate has stopped meaning anything and the right answer is
 * a second aggregator, not another line here.
 */
const PER_EVENT: Record<string, string> = {
  checkLink: 'fires when the owner pastes a link and presses Posted, on one post',
  findRegressions: 'fires on save, comparing the learnings before and after',
};

function aggregator(file: string, name: string): string {
  const body = src(file);
  const at = body.indexOf(`export function ${name}`);
  assert.notEqual(at, -1, `${file} has no ${name}`);
  // To the end of the function: the next top-level export, or end of file.
  const next = body.indexOf('\nexport ', at + 10);
  return body.slice(at, next === -1 ? undefined : next);
}

test('every guard in guards.ts is called by validatePlan', () => {
  const gate = aggregator('guards.ts', 'validatePlan');
  const unwired = [...src('guards.ts').matchAll(GUARD)].map(m => m[1]).filter(fn => !gate.includes(fn));
  assert.deepEqual(unwired, [], `written, tested, and never run: ${unwired.join(', ')}`);
});

for (const [file, gateName] of [['tracking.ts', 'validateTracking'], ['learning.ts', 'validateLearnings']] as const) {
  test(`every guard in ${file} is called by ${gateName}, or declared per-event`, () => {
    const gate = aggregator(file, gateName);
    const unwired = [...src(file).matchAll(GUARD)].map(m => m[1])
      .filter(fn => !gate.includes(fn) && !(fn in PER_EVENT));
    assert.deepEqual(unwired, [], `written, tested, and never run: ${unwired.join(', ')}`);
  });
}

/**
 * Proven twice, and the second way is the one that counts.
 *
 * Asserting the patterns (below) proves they compile. Adding a real orphaned
 * `export async function` to `src/` and watching this file go red proves the
 * fix DOES something: async-blind patterns plus that orphan is 0 red, and with
 * the fix it is 1 red on "every export is either wired or a declared entry
 * point". The Competitor Tracker's method, and it is better than mine.
 *
 * The first attempt at it proved nothing, because the direct assertion below
 * was still in place and went red on its own account: both arms came back 1 red
 * for different reasons. **A mutation with two possible causes measures
 * neither.** Remove the other cause before believing the result.
 */
test('the gate can see an async export at all', () => {
  // `export async function` matched none of the patterns in this file, so an
  // async guard was invisible to the gate and an async entry point was reported
  // as not existing. Both patterns are asserted directly, because breaking the
  // fix came back 0 red: there is no async guard in src today, so nothing else
  // exercises it. The point of a defensive fix is the day something does.
  const sample = 'export async function findSomething(x: string) {}\nexport async function helper() {}';
  assert.deepEqual([...sample.matchAll(GUARD)].map(m => m[1]), ['findSomething']);
  assert.deepEqual([...sample.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map(m => m[1]),
    ['findSomething', 'helper']);
});

test('every per-event guard exists, and is on the entry-point list', () => {
  const all = FILES.map(src).join('\n');
  for (const [fn, when] of Object.entries(PER_EVENT)) {
    assert.ok(new RegExp(`^export (?:async )?function ${fn}\\b`, 'm').test(all), `${fn} is exempted and does not exist`);
    assert.ok(ENTRY_POINTS.includes(fn), `${fn} is exempted from the gate and not declared an entry point`);
    assert.ok(when.length > 20, `${fn} is exempted without saying when it fires`);
  }
});

test('every guard in recommend.ts is called by validateRecommendation', () => {
  const gate = aggregator('recommend.ts', 'validateRecommendation');
  const unwired = [...src('recommend.ts').matchAll(GUARD)].map(m => m[1]).filter(fn => !gate.includes(fn));
  assert.deepEqual(unwired, [], `written, tested, and never run: ${unwired.join(', ')}`);
});

/**
 * What the app calls. Everything else in `src/` has to be used by something in
 * `src/`, or it is dead code or an unwired guard.
 *
 * The list is the point. Adding an export forces one decision: is this the
 * app's to call, or is it internal and therefore has to be wired to something?
 * `isWritten`, `ANGLES` and `WEEKS` were all defined, were neither, and sat
 * there doing nothing while the suite stayed green.
 */
const ENTRY_POINTS = [
  'validatePlan',            // the gate over a written plan
  'validateShape',           // the gate over the month's shape
  'validateRecommendation',  // the gate over what we suggest
  'recommendCadence',        // 2b, the recommendation itself
  'planDates', 'postCount', 'postDays', 'slotWeeks', 'countByPurpose',
  'applyCritique', 'voiceNoteAsText', 'describeRewrite', 'rewriteSet',
  'findOverwrites', 'checkRewriteCalls',
  'listGaps', 'cadenceOf', 'countWords',
  'validateTracking', 'validateLearnings',   // the two gates over tracking
  'fetchPublishedCaption', 'captionFrom', 'classifyError', 'SAYS', 'OEMBED',  // reading a caption back
  'summarise', 'whyNoMetrics', 'bestBy', 'checkLink',        // the top section
  'live', 'alreadyKnown', 'classifyDiff', 'learnFromDiffs',  // the learning store
  'findRegressions',                          // "do not regress", called by the app
];

// Read the directory, do not name the files. A list of members has to be edited
// every time one is added and nothing fails when you forget: on 15 September
// `tracking.ts` and `learning.ts` were added and this gate silently covered
// neither, in the same file that cites that lesson for test files two tests
// below. The rule applies to its own author.
const FILES = readdirSync(join(import.meta.dirname, '..', 'src')).filter(f => f.endsWith('.ts'));

test('every export is either wired inside src or a declared entry point', () => {
  const all = FILES.map(src).join('\n');
  const orphans: string[] = [];
  for (const f of FILES) {
    for (const m of src(f).matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)) {
      if (ENTRY_POINTS.includes(m[1])) continue;
      // Once for its own definition. No second mention means nothing calls it.
      if (all.split(new RegExp(`\\b${m[1]}\\b`)).length - 1 <= 1) orphans.push(`${f}:${m[1]}`);
    }
  }
  assert.deepEqual(orphans, [], `defined and never used: ${orphans.join(', ')}`);
});

test('every declared entry point exists and is covered by a test', () => {
  const all = FILES.map(src).join('\n');
  // Every test file in the directory, not a list of them. A rule that names its
  // members breaks the next time one is added and nothing reports it, which is
  // the same defect `design-rules.md` records for breakpoint collapse rules.
  const tests = readdirSync(import.meta.dirname)
    .filter(f => f.endsWith('.test.ts') && f !== 'wiring.test.ts')
    .map(f => readFileSync(join(import.meta.dirname, f), 'utf8'))
    .join('\n');
  for (const fn of ENTRY_POINTS) {
    assert.ok(new RegExp(`^export (?:async )?(?:function|const) ${fn}\\b`, 'm').test(all), `${fn} is listed and does not exist`);
    assert.ok(new RegExp(`\\b${fn}\\b`).test(tests), `${fn} is the app's to call and nothing tests it`);
  }
});
