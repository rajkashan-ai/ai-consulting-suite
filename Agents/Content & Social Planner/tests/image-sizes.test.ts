/**
 * One list of image sizes, in three places that must agree.
 *
 * `image-sizes.md` is the record with its source and its date. `resizer.html`
 * is the standalone tool. `workspace.html` is the product. The `who` line —
 * what each size is actually for — was written in the standalone and quietly
 * dropped when the block went into the workspace, so the product shipped
 * "Full screen 1080 x 1920" with nothing saying that is the Story, the Reel and
 * TikTok. Nothing noticed, because nothing compared the two.
 *
 * These numbers are facts about someone else's product and they move, so the
 * table carries a checked-on date and this asserts the date is there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const read = (...p: string[]) => readFileSync(join(HERE, '..', ...p), 'utf8');

type F = { id: string; name: string; w: number; h: number; who: string };

/** Pull the FORMATS array out of a page without running it. */
function formats(src: string, where: string): F[] {
  const at = src.indexOf('FORMATS = [');
  assert.ok(at > -1, `no FORMATS in ${where}`);
  const body = src.slice(at, src.indexOf('];', at));
  const out = [...body.matchAll(/\{id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*w:\s*(\d+),\s*h:\s*(\d+),\s*who:\s*'([^']*)'/g)]
    .map((m) => ({ id: m[1], name: m[2], w: +m[3], h: +m[4], who: m[5] }));
  assert.ok(out.length >= 5, `only parsed ${out.length} formats from ${where}`);
  return out;
}

const page = () => formats(read('..', '..', 'UI', 'workspace.html'), 'workspace.html');
const alone = () => formats(read('resizer.html'), 'resizer.html');
const table = () => read('image-sizes.md');

test('the product and the standalone tool offer exactly the same sizes', () => {
  assert.deepEqual(page(), alone(), 'the two copies of FORMATS have drifted');
});

test('every size says what it is for', () => {
  for (const f of page()) {
    assert.ok(f.who && f.who.split(/\s+/).length >= 2,
      `${f.name} ${f.w}x${f.h} does not say which channels it is for`);
  }
});

test('every size on screen is in the record, at the same pixels', () => {
  const md = table();
  for (const f of page()) {
    const row = new RegExp(`\\|\\s*${f.name}\\s*\\|\\s*${f.w} × ${f.h}\\s*\\|`);
    assert.match(md, row, `${f.name} ${f.w} × ${f.h} is not in image-sizes.md`);
  }
});

test('the record says when the numbers were checked', () => {
  assert.match(table(), /[Cc]hecked \d{4}-\d{2}-\d{2}/, 'no date on facts that go stale');
});

test('the Amazon sizes are the three Amazon publishes', () => {
  const amz = page().filter((f) => /amazon/i.test(f.name));
  assert.deepEqual(amz.map((f) => `${f.w}x${f.h}`).sort(), ['1200x1200', '1200x628', '900x1600'].sort());
  for (const f of amz) assert.match(f.who, /Amazon ad/, `${f.name} does not say it is for an ad`);
});

test('the record says these are ad creatives and not listing photos', () => {
  const md = table();
  assert.match(md, /not the product photo on a listing/i,
    'nothing stops someone uploading a cropped shopfront as a product image');
});

test('sizes that are identical are flagged rather than silently doubled', () => {
  const src = read('..', '..', 'UI', 'workspace.html');
  assert.match(src, /function duplicateNote\(/, 'no duplicate detection at all');
  const dupes = page().filter((f, _i, all) => all.filter((g) => g.w === f.w && g.h === f.h).length > 1);
  assert.ok(dupes.length >= 2, 'the fixture no longer contains a duplicate pair, so this proves nothing');
});
