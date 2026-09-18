import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The design system, and the things that were silently lost from it.
 *
 * Inter, the warm sand ground and the teal accent all existed, were designed
 * deliberately, and disappeared from the running app without anything failing.
 * The mechanism was a line in globals.css telling whoever changed the design to
 * "re-copy it: cp ../UI/app.css app/design.css". A hand copy only moves what
 * the person doing it remembers to move, and a missing font does not error, it
 * just looks like somebody else's product.
 *
 * So these are not style preferences. Each one is a thing that went missing
 * once and nothing noticed. Raj, 2026-09-16: "ensure it does not regress this
 * time."
 */

const here = import.meta.dirname;
const css = readFileSync(join(here, "..", "app", "design.css"), "utf8");
const globals = readFileSync(join(here, "..", "app", "globals.css"), "utf8");
const layout = readFileSync(join(here, "..", "app", "layout.tsx"), "utf8");

// ---------------------------------------------------------------------------
// The tokens that went missing.
// ---------------------------------------------------------------------------

test("every token the suite is built from exists", () => {
  for (const token of [
    "--ink", "--ink-soft", "--muted",
    "--sand", "--paper", "--card", "--card-2",
    "--line", "--line-soft",
    "--chrome", "--chrome-soft", "--chrome-line",
    "--brand", "--brand-ink", "--brand-wash",
    "--teal", "--teal-wash",
    "--good", "--warn", "--bad", "--info",
    "--sys", "--mono",
  ]) {
    assert.match(css, new RegExp(`${token}\\s*:`), `${token} is gone`);
  }
});

test("the warm ground and the second accent are defined in both themes", () => {
  // Lost once already. A token defined only in light renders as nothing in
  // dark, which is the classic unreadable-page bug.
  const dark = css.slice(css.indexOf("prefers-color-scheme:dark"));
  for (const token of ["--sand", "--teal", "--chrome"]) {
    assert.match(dark, new RegExp(`${token}\\s*:`), `${token} has no dark value`);
  }
});

test("the neutrals are warm, not grey", () => {
  /**
   * Where most of the warmth actually comes from. A pure grey beside a berry
   * accent reads as two unrelated decisions. These are pulled a few degrees
   * towards the berry so the greys and the accent are one family.
   *
   * Checked by hue: a warm neutral has more red than blue in it.
   */
  const warm = (hex: string) => {
    const [r, , b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return r > b;
  };
  for (const token of ["--sand", "--paper", "--card-2", "--line"]) {
    const found = css.match(new RegExp(`${token}\\s*:\\s*(#[0-9a-f]{6})`, "i"));
    assert.ok(found, `${token} is not a plain hex any more`);
    assert.ok(warm(found![1]), `${token} is ${found![1]}, which is not warm`);
  }
});

test("every custom property the stylesheet uses is defined in it", () => {
  /**
   * The general version of the test above, and the one that matters.
   *
   * On 2026-09-16 the whole :root block was replaced rather than edited, and
   * the spacing scale, the radii and the two grounds went with it. Every
   * padding, margin, gap and radius in the file became invalid at once and the
   * page rendered flush to the edges with no containers.
   *
   * Nothing failed, because an undefined custom property is not an error: the
   * declaration is just dropped. Listing the tokens I happened to think of
   * would have missed it, so this checks the whole file against itself.
   */
  const used = new Set(
    [...css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1].toLowerCase()),
  );
  const defined = new Set(
    [...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1].toLowerCase()),
  );

  // Set by next/font in the layout, not by this file.
  /* Emitted by next/font in app/layout.tsx, not declared in the stylesheet. */
  for (const fromLayout of ["--font-sys", "--font-mono", "--font-display"]) defined.add(fromLayout);

  const missing = [...used].filter((t) => !defined.has(t)).sort();
  assert.deepEqual(missing, [], `used but never defined:\n  ${missing.join("\n  ")}`);
});

test("the spacing scale and the radii are all present", () => {
  // Named explicitly as well, because these are what went, and a named test
  // says what broke rather than only that something did.
  for (let i = 1; i <= 12; i += 1) {
    assert.match(css, new RegExp(`--s${i}\\s*:`), `--s${i} is gone`);
  }
  for (const r of ["--r-card", "--r-control", "--r-chip", "--r-pill"]) {
    assert.match(css, new RegExp(`${r}\\s*:`), `${r} is gone`);
  }
});

// ---------------------------------------------------------------------------
// The fonts, and where they are loaded.
// ---------------------------------------------------------------------------

test("all three faces are loaded, once, in the layout and nowhere else", () => {
  /**
   * The app fell back to the system stack once and nothing failed, because a
   * fallback stack does not fail, it just looks like somebody else's product.
   *
   * Three since the Instrument handoff of 2026-09-18: Space Grotesk names a
   * thing, Manrope explains it, JetBrains Mono measures it. One face doing all
   * three jobs is why a price and a sentence used to have the same texture.
   */
  assert.match(layout, /from "next\/font\/google"/);
  assert.match(layout, /Space_Grotesk\(/);
  assert.match(layout, /Manrope\(/);
  assert.match(layout, /JetBrains_Mono\(/);
  for (const v of ["display.variable", "ui.variable", "mono.variable"]) {
    assert.ok(layout.includes(v), `${v} is loaded and never reaches the html element`);
  }
  /* Self-hosted, so a web font does not break the privacy promise. */
  assert.doesNotMatch(layout, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test("the stylesheet reads the faces from the layout, not from a hardcoded name", () => {
  assert.match(css, /--sys:\s*var\(--font-sys\)/);
  assert.match(css, /--mono:\s*var\(--font-mono\)/);
});

// ---------------------------------------------------------------------------
// One stylesheet, and the copy that lost the last one.
// ---------------------------------------------------------------------------

test("nothing tells anyone to hand copy the stylesheet", () => {
  // The exact mechanism of the loss. A copy step in a comment is a promise
  // that somebody will remember, and nobody did.
  assert.doesNotMatch(globals, /cp .*app\.css/, "the copy instruction is back");
  assert.doesNotMatch(globals, /source of truth/i, "UI/ is claiming to be the source again");
});

test("no tool defines its own colours or faces", () => {
  /**
   * Raj: "This should be done in a central place so it is used by the whole
   * suite. Each tool should not have its own styling."
   *
   * A hex in a component is a colour nothing can change centrally, and it will
   * be the one that stays navy when everything else goes warm.
   */
  const dir = join(here, "..", "app", "workspace", "[tool]");
  const offenders: string[] = [];

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
    const body = readFileSync(join(dir, file), "utf8");
    if (/#[0-9a-fA-F]{6}\b/.test(body)) offenders.push(`${file}: a hex colour`);
    if (/font-family\s*:/.test(body)) offenders.push(`${file}: a font-family`);
    if (/style=\{\{[^}]*(color|background)/.test(body)) offenders.push(`${file}: an inline colour`);
  }

  assert.deepEqual(offenders, [], `styling that belongs in design.css:\n  ${offenders.join("\n  ")}`);
});

// ---------------------------------------------------------------------------
// The rules the system is built on.
// ---------------------------------------------------------------------------

test("figures are set in the mono face and aligned", () => {
  // A column of prices in a proportional face is a paragraph.
  /* The rule that DEFINES it, not the first mention of the name. `.app` now
     carries an override that sits earlier in the file, and a positional slice
     from the first occurrence read that instead and reported the mono face
     missing from a file that still sets it. */
  const at = css.indexOf("\n.kpi__n{");
  assert.ok(at > -1, "the rule that defines the figure is gone");
  const kpi = css.slice(at, at + 300);
  assert.match(kpi, /font-family:var\(--mono\)/);
  assert.match(kpi, /tabular-nums/);
});

test("teal is a figure colour and never a status", () => {
  // If something needs to look important and the only way found is a status
  // colour, it is in the wrong place in the hierarchy. Those four mean what
  // they mean.
  assert.match(css, /\.t-win\{color:var\(--teal\)\}/);
  assert.doesNotMatch(css, /--good\s*:\s*var\(--teal\)/);
  assert.doesNotMatch(css, /--warn\s*:\s*var\(--teal\)/);
});

test("there are no shadow tokens", () => {
  /**
   * Flat is a scale problem, not a shadow problem. Linear ships three border
   * tokens and zero shadow tokens; Stripe and Vercel moved from soft shadows to
   * hairline borders across 2025 and 2026. A shadow is for something that
   * genuinely floats: a menu, a dialog, a tooltip.
   */
  assert.doesNotMatch(css, /--shadow[a-z-]*\s*:/, "a shadow token is back");
});

test("no utility framework is imported over our own class names", () => {
  /**
   * Tailwind was imported and no Tailwind utility was ever used. What it did
   * was emit `.grid{display:grid}`, because the Competitor Tracker's comparison
   * table is called `.grid` and Tailwind generates a utility for any name it
   * sees in the source. `display:grid` on a <table> destroys table layout: the
   * <thead> becomes a block, stops sharing columns with the body, and the six
   * column headings sit out of line with the row beneath. Measured on
   * 2026-09-18: header cells 157/87/149/102/126px against body cells of 120px.
   *
   * Nothing in our stylesheets sets `display` on `.grid`, so there was nothing
   * to out-specify it with. The fix was to stop importing a library whose whole
   * job is to claim short class names, in a codebase that names its components
   * after what they are.
   */
  const globals = readFileSync(join(import.meta.dirname, "..", "app", "globals.css"), "utf8");
  const code = globals.replace(/\/\*[\s\S]*?\*\//g, " ");
  assert.doesNotMatch(code, /@import\s+["']tailwindcss["']/, "a utility framework is back over our class names");
  /* And our own reset is still the one doing the job Tailwind's preflight did. */
  assert.match(css, /\*\{box-sizing:border-box\}/, "the reset went with it");
});

test("the comparison table is laid out as a table", () => {
  /* The property that was overridden. Asserted positively so the next library
     that claims `.grid` fails here rather than on somebody's screen. */
  assert.match(css, /\.grid \{ table-layout: fixed; \}/);
  assert.doesNotMatch(css, /\.grid\s*\{[^}]*display:\s*grid/, ".grid is being drawn as a CSS grid");
});
