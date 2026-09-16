"use client";

import { useEffect, useRef, useState } from "react";
import { IMAGE_SIZES } from "../../../../Agents/Content & Social Planner/src/platform";
import { cropBox, fitPreview, keptFraction } from "../../../../Agents/Content & Social Planner/src/preview.js";

/**
 * Resize one photo for every place it is going.
 *
 * This was built, tested and on the mockup, and it did not survive the move
 * into the app: the screen was rebuilt from the spec's section list, and the
 * resizer had never been written into the spec. So nothing noticed, including
 * the test I wrote for "every section of the plan", which listed the sections I
 * had built rather than the ones the tool is supposed to have. That is a test
 * written to match the code, which is the first trap in TESTING.md 7.
 *
 * The geometry is imported, not rewritten. `cropBox` keeps the focal point in
 * frame and `fitPreview` scales the preview by both sides, and both exist
 * because Raj found the bugs they fix: a crop that cut a face in half, and a
 * preview that drew 2850 pixels tall for a full page screenshot.
 *
 * The sizes come from `platform.ts`, where every fact about somebody else's
 * product carries its source and the date it was checked.
 *
 * NOTHING LEAVES THE MACHINE. The file is read into a canvas in the browser and
 * written back out. It is never uploaded, and the page says so, because an
 * owner handing over a photo of their shop deserves to know where it goes.
 */

type Focal = { x: number; y: number };

const SIZES = IMAGE_SIZES.map((s) => s.value);

export default function Resizer() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("");
  const [focal, setFocal] = useState<Focal>({ x: 0.5, y: 0.5 });
  const [chosen, setChosen] = useState<string[]>(SIZES.filter((s) => s.on).map((s) => s.id));
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  /* Dragging over the box, which the stylesheet already has a look for. */
  const [over, setOver] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  /** Two sizes with the same pixels write the same file twice. Say so. */
  const twins = (() => {
    const by = new Map<string, string>();
    const same: string[] = [];
    for (const s of SIZES.filter((x) => chosen.includes(x.id))) {
      const key = `${s.w}x${s.h}`;
      const first = by.get(key);
      if (first) {
        if (!same.includes(first)) same.push(first);
        same.push(s.name);
      } else by.set(key, s.name);
    }
    return same;
  })();

  function take(file: File | undefined) {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setName(file.name.replace(/\.[^.]+$/, ""));
      setFocal({ x: 0.5, y: 0.5 });
      setSaid("");
    };
    img.src = URL.createObjectURL(file);
  }

  /**
   * Drawn after the canvas exists, not when the photo loads.
   *
   * The canvas is inside the block that only renders once there is an image, so
   * at the moment the photo finished loading there was no canvas to draw on:
   * the ref was still null, draw returned immediately, and what the owner got
   * was a correctly sized empty box where their photo should be. Nothing threw
   * and nothing logged, which is why it looked like a styling fault.
   */
  useEffect(() => {
    if (image) draw(image, focal);
  }, [image, focal]);

  function draw(img: HTMLImageElement, at: Focal) {
    const c = canvas.current;
    if (!c) return;
    const fit = fitPreview(img.naturalWidth, img.naturalHeight);
    c.width = fit.w;
    c.height = fit.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, fit.w, fit.h);
    /* The circle is where the crop is held, and it is draggable, because the
       guess is a guess: Raj's rule is that the core of the picture stays in
       frame, and only they know what the core is. */
    /* The two colours come from the stylesheet's own tokens, not from hex
       written here. A canvas cannot take a class, but it can be told what the
       token currently resolves to, which also means the marker follows the
       theme instead of being white on white in the dark one. */
    const token = (name: string, fallback: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

    ctx.beginPath();
    ctx.arc(at.x * fit.w, at.y * fit.h, 14, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = token("--card", "white");
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = token("--ink", "black");
    ctx.stroke();
  }

  function moveFocal(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!image) return;
    const box = e.currentTarget.getBoundingClientRect();
    const at = {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
    setFocal(at);
    draw(image, at);
  }

  /** The tightest crop of the set, so we can warn before anything is written. */
  const tightest = (() => {
    if (!image) return 1;
    return Math.min(
      1,
      ...SIZES.filter((s) => chosen.includes(s.id)).map((s) =>
        keptFraction(image.naturalWidth, image.naturalHeight, cropBox(image.naturalWidth, image.naturalHeight, s.w, s.h, focal)),
      ),
    );
  })();

  async function saveAll() {
    if (!image || !chosen.length) return;
    setBusy(true);
    setSaid("Working");
    try {
      const wanted = SIZES.filter((s) => chosen.includes(s.id));
      const files: { name: string; blob: Blob }[] = [];

      for (const size of wanted) {
        const box = cropBox(image.naturalWidth, image.naturalHeight, size.w, size.h, focal);
        const out = document.createElement("canvas");
        out.width = size.w;
        out.height = size.h;
        const ctx = out.getContext("2d");
        if (!ctx) continue;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, box.x, box.y, box.w, box.h, 0, 0, size.w, size.h);
        const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/jpeg", 0.9));
        if (blob) files.push({ name: `${name}-${size.id}-${size.w}x${size.h}.jpg`, blob });
      }

      /**
       * Their folder, if the browser can ask for one.
       *
       * `showDirectoryPicker` is Chromium only. Where it is missing the files
       * are offered one at a time instead, and the screen says which is
       * happening rather than failing quietly on somebody's Safari.
       */
      const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker;

      if (picker) {
        try {
          const root = await picker.call(window);
          const folder = await root.getDirectoryHandle(`${name} for posting`, { create: true });
          for (const f of files) {
            const handle = await folder.getFileHandle(f.name, { create: true });
            const writable = await handle.createWritable();
            await writable.write(f.blob);
            await writable.close();
          }
          setSaid(`${files.length} saved into "${name} for posting".`);
          return;
        } catch (e) {
          /**
           * The three ways choosing a folder ends, which are not the same thing.
           *
           * Raj hit the middle one: the browser refuses a folder it considers
           * the system's, and says "can't open this folder because it contains
           * system files". The Desktop root and the home folder are both
           * usually refused. Saying "nothing was saved" there is true and
           * useless, because it does not say the one thing they need to know,
           * which is to pick a different folder or let it go to downloads.
           *
           * Cancel is a decision and gets no lecture. Anything else falls
           * through to downloads rather than dead ending, because the files
           * are already made and throwing them away helps nobody.
           */
          const why = e instanceof Error ? e.name : "";
          if (why === "AbortError") {
            setSaid("Nothing saved. Nothing has been lost, press it again when you want them.");
            return;
          }
          setSaid("That folder is one the browser will not write to, so these went to your downloads instead. A folder inside Documents works.");
        }
      }

      /* Downloads, either because this browser cannot pick a folder at all or
         because the one they picked was refused. */
      for (const f of files) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f.blob);
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      setSaid((was) =>
        was ||
        `${files.length} saved to your downloads. This browser cannot save into a folder you choose.`,
      );
    } catch {
      setSaid("We could not make the files. Try a different photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="t-section">Resize a photo</h2>
      <p className="t-doc-sm">
        You took the photo a post asked for. Put it here and get it at the right size for every
        place it is going. It never leaves your computer.
      </p>

      {/* A label wrapping the input, so there is one button and it says a word.
          The input is clipped rather than display:none, because a file input
          the keyboard cannot reach is a file nobody on a keyboard can choose.
          The label is not a second "Choose a photo": the heading above it said
          the same thing twice, which on screen read as two buttons. */}
      <div
        className={`drop${over ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
      >
        <p className="t-row">
          <strong>{image ? name : "The photo a post asked you for"}</strong>
        </p>
        <p className="t-meta">Drop it here, or</p>
        <label className="btn">
          Choose a photo
          <input
            type="file"
            accept="image/*"
            onChange={(e) => take(e.target.files?.[0])}
            aria-label="The photo to resize"
          />
        </label>
      </div>

      {image ? (
        <div className="card">
          <div className="card__body">
            <p className="t-kind">What stays in the picture</p>
            <p className="t-doc-sm">
              Click the photo to move the circle if we have the wrong part of it. Every size follows
              it.
            </p>
            <canvas className="cropper" ref={canvas} onClick={moveFocal} />

            {tightest < 0.45 ? (
              <div className="inset">
                <p className="t-row">
                  The tallest size keeps about {Math.round(tightest * 100)} per cent of this photo.
                  A wider one loses less.
                </p>
              </div>
            ) : null}

            <p className="t-kind">The sizes</p>
            <div className="sizes">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="toggle toggle--stack"
                  aria-pressed={chosen.includes(s.id)}
                  onClick={() =>
                    setChosen((was) => (was.includes(s.id) ? was.filter((x) => x !== s.id) : [...was, s.id]))
                  }
                >
                  <span>
                    {s.name} {s.w} × {s.h}
                  </span>
                  <span className="toggle__who">{s.who}</span>
                </button>
              ))}
            </div>

            <p className="t-meta">
              {twins.length
                ? `${twins.join(" and ")} are the same size, so those come out as identical files.`
                : "Instagram Stories, Reels and TikTok all take the same picture, so one file covers them."}
            </p>

            <div className="card__foot">
              <p className="t-meta">
                {chosen.length
                  ? `${chosen.length} file${chosen.length === 1 ? "" : "s"}. You pick the folder.`
                  : "Tick at least one size."}
              </p>
              <button type="button" className="btn--ghost" onClick={() => setImage(null)}>
                Cancel
              </button>
              <button type="button" className="btn" disabled={busy || !chosen.length} onClick={saveAll}>
                {busy ? "Saving" : "Resize and save"}
              </button>
            </div>

            {said ? (
              <div className="inset">
                <p className="t-row">{said}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
