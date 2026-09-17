/**
 * The export carries the sections CLAUDE.md §3 says it does.
 *
 * Nothing asserted this until 15 September, and by then the export and the spec
 * had already drifted: the document was emitting "## The month" and
 * "## The posts" while §3 had said "## This week" and "## The rest of the
 * month" since that morning. No test failed, because every test checked what
 * the sections *contained* and none checked that they were there.
 *
 * The Competitor Tracker hit the same class on its screens and built
 * `tests/structure.test.ts` for the markup. This is the same gate for the
 * document. A test proves the thing it names works. Only an inventory test
 * proves the thing is still there at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { weeksCovered } from '../src/guards.ts';
import { PLAN, exportPlan } from './fixtures/businesses.ts';

const sections = (doc: string) => [...doc.matchAll(/^## (.+)$/gm)].map(m => m[1]);

/** One week: written posts, the shape of the rest, and no separate gap list. */
const WEEK = ['What we suggest', 'What you sound like', 'This week', 'The rest of the month', 'What we did not write'];
/** More than a week: a blank can be scrolled past, so it is listed. */
const MONTH = ['What we suggest', 'What you sound like', 'This week', 'The rest of the month', 'What to fill in', 'What we did not write'];

const asMonth = () => ({ ...PLAN, weeksWritten: 5, posts: PLAN.posts.map((p, i) => ({ ...p, week: Math.floor(i / 2) + 1 })) });

test('a one-week export carries exactly the contract, in order', () => {
  assert.equal(weeksCovered(PLAN), 1);
  assert.deepEqual(sections(exportPlan(PLAN)), WEEK);
});

test('a month-long export adds the gap list, and nothing else', () => {
  const month = asMonth();
  assert.ok(weeksCovered(month) > 1);
  assert.deepEqual(sections(exportPlan(month)), MONTH);
});

test('the contract in this file is the one CLAUDE.md publishes', () => {
  // The two drifted for a day. Whichever is edited, the other has to move with
  // it, and this is what makes that a failing test rather than a discovery.
  const spec = readFileSync(join(import.meta.dirname, '..', 'CLAUDE.md'), 'utf8');
  const block = spec.slice(spec.indexOf('```'), spec.indexOf('```', spec.indexOf('```') + 3));
  assert.deepEqual([...block.matchAll(/^## (.+)$/gm)].map(m => m[1]), MONTH,
    'CLAUDE.md §3 and the export no longer agree on what the document contains');
});

test('every section has something under it', () => {
  // A heading with nothing beneath it is the same failure as a missing one,
  // and it looks healthier.
  const doc = exportPlan(asMonth());
  const parts = doc.split(/^## .+$/m).slice(1);
  parts.forEach((body, i) => assert.ok(body.trim().length > 0, `${MONTH[i]} is an empty heading`));
});

test('no section appears twice', () => {
  const names = sections(exportPlan(asMonth()));
  assert.equal(new Set(names).size, names.length);
});
