/**
 * The resizer's geometry, tested with numbers.
 *
 * Both bugs Raj found in the resizer were geometric: a crop that ignored the
 * focal point, and a preview that scaled by width alone and drew 2850px tall
 * for a full-page screenshot. Every test that existed at the time read the
 * SOURCE of the page and passed through both, because a string assertion cannot
 * see a rectangle.
 *
 * `src/preview.js` is evaluated here and inlined into the page by
 * `UI/sync-preview.py`, so these run against the same code the browser does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/* Imported rather than evaluated out of the file's text.
   It exports now, because the web app imports the same geometry as a module,
   and `new Function` on a source containing `export` is a syntax error. The
   page still gets it inlined: sync-preview.py drops the export lines. */
import { PV_W, PV_H, cropBox, fitPreview, keptFraction } from '../src/preview.js';

/* Real shapes: a wide screenshot, a phone photo both ways up, a DSLR frame,
   a full-page screenshot, a square, and something tiny. */
const SHAPES: [number, number, string][] = [
  [2560, 800, 'wide screenshot'],
  [1200, 1600, 'phone photo, portrait'],
  [1600, 1200, 'phone photo, landscape'],
  [4000, 3000, 'camera frame'],
  [1290, 2796, 'iPhone screenshot'],
  [1200, 3400, 'full-page screenshot'],
  [1080, 1080, 'square'],
  [400, 300, 'small'],
  [60, 40, 'tiny'],
];
const TARGETS: [number, number, string][] = [
  [1080, 1080, 'square feed'], [1080, 1350, 'vertical feed'],
  [1080, 1920, 'full screen'], [1200, 630, 'link preview'], [1200, 1200, 'linkedin'],
];
const POINTS = [[0.5, 0.5], [0, 0], [1, 1], [0.05, 0.95], [0.8, 0.2], [0.25, 0.6]];

/* ── The preview fits its box. This is the bug Raj hit twice ──────────────── */

for (const [sw, sh, name] of SHAPES) {
  test(`preview fits the box: ${name} ${sw}x${sh}`, () => {
    const p = fitPreview(sw, sh);
    assert.ok(p.w <= PV_W, `${p.w}px wide, over the ${PV_W} box`);
    assert.ok(p.h <= PV_H, `${p.h}px tall, over the ${PV_H} box — this is the 2850px bug`);
    assert.ok(p.w >= 1 && p.h >= 1, 'collapsed to nothing');
    assert.ok(Math.abs(p.w - p.h * (sw / sh)) <= 1, `squashed: ${p.w}x${p.h} from ${sw}x${sh}`);
  });
}

test('a small photo is never blown up', () => {
  assert.equal(fitPreview(400, 300).scale, 1);
  assert.deepEqual(fitPreview(60, 40), { w: 60, h: 40, scale: 1 });
});

test('a degenerate size does not produce a zero or a NaN', () => {
  for (const [w, h] of [[0, 0], [-5, 100], [100, 0], [NaN, NaN]]) {
    const p = fitPreview(w, h);
    assert.ok(Number.isFinite(p.w) && Number.isFinite(p.h) && p.w >= 1 && p.h >= 1, `${w}x${h} gave ${JSON.stringify(p)}`);
  }
});

/* ── The crop follows the focal point, and stays inside the photo ─────────── */

test('every shape, every size, every focal point', () => {
  let checked = 0;
  for (const [sw, sh] of SHAPES) for (const [tw, th] of TARGETS) for (const [fx, fy] of POINTS) {
    const b = cropBox(sw, sh, tw, th, { x: fx, y: fy });
    const where = `${sw}x${sh} -> ${tw}x${th} @ ${fx},${fy}`;
    checked++;

    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= sw && b.y + b.h <= sh, `escapes the photo: ${where}`);
    assert.ok(b.w >= 1 && b.h >= 1, `empty crop: ${where}`);

    // The focal point is in the picture that comes out.
    assert.ok(fx * sw >= b.x - 1 && fx * sw <= b.x + b.w + 1, `focal outside the crop horizontally: ${where}`);
    assert.ok(fy * sh >= b.y - 1 && fy * sh <= b.y + b.h + 1, `focal outside the crop vertically: ${where}`);

    // Centred on it, unless the edge of the photo stops it.
    const wantX = Math.max(0, Math.min(sw - b.w, Math.round(fx * sw - b.w / 2)));
    const wantY = Math.max(0, Math.min(sh - b.h, Math.round(fy * sh - b.h / 2)));
    assert.ok(Math.abs(b.x - wantX) <= 1, `not centred on the focal point: ${where}`);
    assert.ok(Math.abs(b.y - wantY) <= 1, `not centred on the focal point: ${where}`);

    // The crop has the target's shape: a window, never a squash.
    //
    // Bounded by rounding, not by a percentage. A crop is whole pixels, so the
    // shape can be off by up to half a pixel on each edge whatever the size —
    // which is 0.1% of a 1200px photo and 2% of a 60px one. A percentage
    // tolerance therefore fails on tiny sources while passing real distortion
    // on large ones, which is the wrong way round.
    assert.ok(Math.abs(b.w - b.h * (tw / th)) <= 1,
      `shape off by more than a pixel: ${b.w}x${b.h} for ${(tw / th).toFixed(3)}: ${where}`);
  }
  assert.ok(checked >= 250, `only ${checked} combinations`);
});

test('moving the focal point moves the crop, where there is room to move', () => {
  const left = cropBox(2560, 800, 1080, 1920, { x: 0.2, y: 0.5 });
  const right = cropBox(2560, 800, 1080, 1920, { x: 0.8, y: 0.5 });
  assert.ok(right.x > left.x + 500, 'the crop ignored the focal point');
  // and up and down on a tall photo
  const top = cropBox(1200, 3400, 1200, 630, { x: 0.5, y: 0.1 });
  const bottom = cropBox(1200, 3400, 1200, 630, { x: 0.5, y: 0.9 });
  assert.ok(bottom.y > top.y + 1500, 'the crop ignored the focal point vertically');
});

test('a crop that cannot move does not pretend to', () => {
  // A square photo into a square target has no freedom in either direction.
  const a = cropBox(1080, 1080, 1080, 1080, { x: 0.1, y: 0.1 });
  const b = cropBox(1080, 1080, 1080, 1080, { x: 0.9, y: 0.9 });
  assert.deepEqual(a, b);
  assert.deepEqual(a, { x: 0, y: 0, w: 1080, h: 1080 });
});

/* ── How much is lost, which drives the warning ───────────────────────────── */

test('the kept fraction is what the screen says it is', () => {
  const wide = cropBox(2560, 800, 1080, 1920, { x: 0.5, y: 0.5 });
  const kept = keptFraction(2560, 800, wide);
  assert.ok(kept > 0 && kept < 0.2, `9:16 from a 3.2:1 photo should be brutal, got ${kept}`);
  assert.equal(keptFraction(1080, 1080, cropBox(1080, 1080, 1080, 1080, { x: 0.5, y: 0.5 })), 1);
});
