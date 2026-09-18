/**
 * A photo on its way to the writer, and the rules about it.
 *
 * WHY A PHOTO IS NEVER STORED
 * It is downscaled in their browser, turned into a string, sent inside the one
 * API call that writes the post, and forgotten. There is no bucket, so there is
 * no retention question, nothing to add to `deleteEverything`, and no second
 * copy of somebody's customer sitting in a database we would then have to
 * defend. The photo exists for about twenty seconds and only in memory.
 *
 * Nothing here touches a canvas or a model. It is the arithmetic and the
 * refusals, so both can be tested without a browser and without spending.
 */

/**
 * The longest edge we send, in pixels.
 *
 * Sonnet 5 accepts up to 2576 on the long edge. We deliberately do not use it:
 * at that size one image costs up to 4784 image tokens against 1568, and
 * Anthropic's own migration note says to downsample when the added fidelity is
 * not needed. Telling the difference between a balayage and a blunt fringe is
 * not a high-resolution task. If we ever ask a photo to read small print off a
 * price board, this is the number to revisit, with a measurement rather than a
 * feeling.
 */
export const LONG_EDGE = 1568;

/** What the canvas writes out. One format out, whatever went in. */
export const SENT_AS = "image/jpeg";

/**
 * JPEG quality for the downscale.
 *
 * 0.82 rather than the resizer's 0.9. That one is making a file somebody posts;
 * this one is making a file a model looks at once and nobody ever sees.
 */
export const QUALITY = 0.82;

/**
 * The most base64 we will carry, in characters.
 *
 * A Next server action rejects a body over 1 MB with a 413, which reaches the
 * owner as a failure with no explanation (verified in Next's own
 * action-handler, which defaults bodySizeLimitBytes to 1024 * 1024). Base64 is
 * about a third bigger than the bytes it encodes, so this is roughly a 512 KB
 * photo and leaves the rest of the request comfortable room.
 *
 * Raising the framework limit instead would mean a bigger photo for a model
 * that is going to downsample it anyway.
 */
export const MOST_BASE64 = 700_000;

/** What a browser may hand us. Everything leaves as JPEG regardless. */
export const TAKES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export type Photo = { media_type: string; data: string };

/**
 * The size to draw at, keeping the shape.
 *
 * A photo already smaller than the limit is left alone rather than blown up:
 * enlarging invents detail, and a model reading invented detail is the whole
 * thing we are trying not to do.
 */
export function drawAt(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return { width: 0, height: 0 };
  }
  const longest = Math.max(width, height);
  if (longest <= LONG_EDGE) return { width: Math.round(width), height: Math.round(height) };
  const scale = LONG_EDGE / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Split what the canvas produced into what the API takes.
 *
 * `canvas.toDataURL` gives "data:image/jpeg;base64,/9j/4AAQ...". The API wants
 * the media type and the payload separately, and it wants the payload without
 * the prefix. Handing it the whole data url is the obvious mistake and it fails
 * as a decode error a long way from here, so it is refused by name instead.
 */
export function asPhoto(dataUrl: unknown): Photo | { error: string } {
  if (typeof dataUrl !== "string" || !dataUrl) {
    return { error: "We did not get the photo. Try choosing it again." };
  }

  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return { error: "That file did not arrive as a photo. Try choosing it again." };

  const [, mediaType, data] = match;
  if (!(TAKES as readonly string[]).includes(mediaType.toLowerCase())) {
    return { error: "That is not a kind of photo we can read. A JPEG or a PNG works." };
  }
  if (data.length > MOST_BASE64) {
    return { error: "That photo is too big to send. Try a smaller one." };
  }
  return { media_type: mediaType.toLowerCase(), data };
}
