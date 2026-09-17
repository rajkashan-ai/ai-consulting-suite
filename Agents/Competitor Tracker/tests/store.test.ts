/**
 * Keeping a week, and comparing two.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, keyFor, freshnessOf } from '../src/store.ts';
import { changesBetween, say, summarise } from '../src/changes.ts';

const newStore = async () => new Store(await mkdtemp(join(tmpdir(), 'ct-store-')));

test('one business has one name, however the url was typed', () => {
  // Three spellings storing three files would run the research three times and
  // compare a business against itself a week later.
  const keys = ['shrewsburybarber.co.uk', 'https://www.shrewsburybarber.co.uk/',
                'HTTPS://ShrewsburyBarber.co.uk', 'http://shrewsburybarber.co.uk/price-menu']
    .map(keyFor);
  assert.equal(new Set(keys).size, 1, `got ${new Set(keys).size} names: ${[...new Set(keys)].join(', ')}`);
});

test('a run comes back as it went in', async () => {
  const s = await newStore();
  await s.save('https://shrewsburybarber.co.uk/', { competitors: ['HINCES'] }, '2026-09-15T08:00:00.000Z');
  const got = await s.load<{ competitors: string[] }>('shrewsburybarber.co.uk');
  assert.equal(got?.ranAt, '2026-09-15T08:00:00.000Z');
  assert.deepEqual(got?.run.competitors, ['HINCES']);
});

test('nothing stored is not an error, it is an answer', async () => {
  const s = await newStore();
  assert.equal(await s.load('never-seen.example'), null);
  assert.equal(freshnessOf(null).state, 'none');
});

test('an unreadable file counts as no week held, not as a crash', async () => {
  const s = await newStore();
  await s.save('x.example', { a: 1 });
  const dir = (await s.list());
  assert.equal(dir.length, 1);
  await writeFile(join(s.dir, `${keyFor('x.example')}.json`), '{ this is not json');
  assert.equal(await s.load('x.example'), null);
});

test('a saved run leaves no temporary file behind', async () => {
  // Written to a temp name and moved, so a crash cannot leave a half-file that
  // parses as nothing and silently forces a re-run of everything.
  const s = await newStore();
  await s.save('x.example', { a: 1 });
  const files = await readdir(s.dir);
  assert.deepEqual(files.filter(f => f.endsWith('.tmp')), []);
});

test('inside the week it is fresh, and it says when it expires', () => {
  const ranAt = '2026-09-15T08:00:00.000Z';
  const f = freshnessOf({ input: 'x', ranAt, run: {} }, new Date('2026-09-18T08:00:00.000Z'));
  assert.equal(f.state, 'fresh');
  if (f.state !== 'fresh') return;
  assert.equal(f.ageDays, 3);
  assert.equal(f.nextRunAt.slice(0, 10), '2026-09-22');
});

test('after the week it is stale', () => {
  const f = freshnessOf({ input: 'x', ranAt: '2026-09-01T08:00:00.000Z', run: {} },
                        new Date('2026-09-15T08:00:00.000Z'));
  assert.equal(f.state, 'stale');
});

/* ── what changed ─────────────────────────────────────────────────────────── */

const run = (ranAt: string, comps: any[]) => ({ ranAt, competitors: comps });

test('the first run compares against nothing, and says so', () => {
  const changes = changesBetween(null, run('2026-09-15', [{ name: 'HINCES', reviewCount: 2461 }]));
  assert.deepEqual(changes, []);
  assert.match(summarise(changes, null), /first run/);
});

test('a review count that moved is reported with both ends', () => {
  const c = changesBetween(
    run('2026-09-08', [{ name: 'HINCES', reviewCount: 2421 }]),
    run('2026-09-15', [{ name: 'HINCES', reviewCount: 2461 }]));
  assert.deepEqual(c, [{ kind: 'reviews', name: 'HINCES', from: 2421, to: 2461, by: 40 }]);
  assert.match(say(c[0]), /gained 40 reviews, now 2,461/);
});

test('a price cut is named as a cut, not as a number', () => {
  const c = changesBetween(
    run('2026-09-08', [{ name: 'The Fade Inn', headlinePrice: 22 }]),
    run('2026-09-15', [{ name: 'The Fade Inn', headlinePrice: 20 }]));
  assert.match(say(c[0]), /cut their price from £22 to £20/);
});

test('becoming readable is never reported as growth', () => {
  // The defect this prevents: a competitor we could not read last week appears
  // with 2,461 reviews this week. That is not 2,461 new reviews, it is us
  // finally being able to see. Reporting it as a jump invents a movement out of
  // our own blind spot.
  const c = changesBetween(
    run('2026-09-08', [{ name: 'HINCES', unread: true }]),
    run('2026-09-15', [{ name: 'HINCES', reviewCount: 2461 }]));
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, 'now-readable');
  assert.match(say(c[0]), /start from today rather than showing a jump/);
});

test('losing access is said plainly, and last week’s numbers are not restated as new', () => {
  const c = changesBetween(
    run('2026-09-08', [{ name: 'HINCES', reviewCount: 2461 }]),
    run('2026-09-15', [{ name: 'HINCES', unread: true }]));
  assert.equal(c[0].kind, 'now-unreadable');
});

test('a rating change below the published precision is rounding, not movement', () => {
  const c = changesBetween(
    run('2026-09-08', [{ name: 'HINCES', rating: 4.98 }]),
    run('2026-09-15', [{ name: 'HINCES', rating: 4.99 }]));
  assert.deepEqual(c, []);
});

test('arrivals and departures are both reported', () => {
  const c = changesBetween(
    run('2026-09-08', [{ name: 'Old Shop', reviewCount: 10 }]),
    run('2026-09-15', [{ name: 'New Shop', reviewCount: 5 }]));
  assert.deepEqual(c.map(x => x.kind).sort(), ['arrived', 'gone']);
});

test('nothing moved is a different answer from not having looked', () => {
  const same = [{ name: 'HINCES', reviewCount: 2461 }];
  const c = changesBetween(run('2026-09-08', same), run('2026-09-15', same));
  assert.deepEqual(c, []);
  assert.match(summarise(c, '2026-09-08'), /Nothing moved since 2026-09-08/);
  assert.match(summarise(c, null), /first run/);
});
