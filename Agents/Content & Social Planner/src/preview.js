/**
 * The resizer's geometry. Plain JavaScript on purpose.
 *
 * WHY THIS FILE EXISTS
 * The preview and the crop lived only inside a script block in
 * `UI/workspace.html`, so the only tests possible were string assertions about
 * the source. Two rounds of those caught nothing, because both bugs Raj found
 * were about geometry: a crop that ignored the focal point, and a preview that
 * scaled by width alone and drew 2850px tall for a full-page screenshot. A test
 * that reads the source cannot see either.
 *
 * So the maths is here, it is tested with numbers, and `UI/sync-preview.py`
 * inlines it into the page between markers. Exactly what `app.css` and
 * `sync-styles.py` already do, and for the same reason: one source, copied by a
 * script rather than by hand, with a check that the copy still matches.
 *
 * No DOM, no imports, no TypeScript. It has to run unchanged in node and in a
 * browser script block.
 */

/** The preview is never bigger than this box, in CSS pixels. */
var PV_W = 720, PV_H = 420;

/**
 * Fit a photo inside the preview box.
 *
 * Scales by whichever dimension runs out first, and never above 1: an upscaled
 * preview is a blurry lie about what they are going to save.
 *
 * @param {number} sw source width  @param {number} sh source height
 * @returns {{w:number,h:number,scale:number}}
 */
function fitPreview(sw, sh) {
  if (!(sw > 0) || !(sh > 0)) return { w: 1, h: 1, scale: 1 };
  var scale = Math.min(PV_W / sw, PV_H / sh, 1);
  return { w: Math.max(1, Math.round(sw * scale)), h: Math.max(1, Math.round(sh * scale)), scale: scale };
}

/**
 * The region of the photo that survives a crop to `tw` by `th`.
 *
 * Centred on the focal point, then pushed back inside the photo. Never
 * stretches: the crop always has the target's shape and is only ever a window
 * onto the original pixels.
 *
 * @param {number} sw @param {number} sh @param {number} tw @param {number} th
 * @param {{x:number,y:number}} focal  0..1 of the width and height
 * @returns {{x:number,y:number,w:number,h:number}}
 */
function cropBox(sw, sh, tw, th, focal) {
  var scale = Math.max(tw / sw, th / sh);
  var cw = Math.min(sw, Math.round(tw / scale));
  var ch = Math.min(sh, Math.round(th / scale));
  var x = Math.round(focal.x * sw - cw / 2);
  var y = Math.round(focal.y * sh - ch / 2);
  return {
    x: Math.max(0, Math.min(sw - cw, x)),
    y: Math.max(0, Math.min(sh - ch, y)),
    w: cw, h: ch,
  };
}

/** How much of the photo a crop keeps, 0..1. Decides the "this is tight" note. */
function keptFraction(sw, sh, box) {
  if (!(sw > 0) || !(sh > 0)) return 0;
  return (box.w * box.h) / (sw * sh);
}

/* Three callers, one source.
 *
 * The test evaluates this file, `UI/sync-preview.py` inlines it into a plain
 * script block, and the web app imports it as a module. An `export` is a syntax
 * error in a classic script and cannot be written conditionally, so the exports
 * stay here and the inliner drops the lines on the way in.
 *
 * The alternative was a second copy of the geometry inside `web/`, and two
 * copies of one rule is the defect this project has now found in the engine,
 * the tool screen, the running panel, the channel names and the image sizes. */
export { PV_W, PV_H, fitPreview, cropBox, keptFraction };
