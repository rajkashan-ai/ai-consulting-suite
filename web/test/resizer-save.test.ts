import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const resizer = readFileSync(
  join(import.meta.dirname, "..", "app", "workspace", "[tool]", "resizer.tsx"),
  "utf8",
);

/**
 * 2026-09-18, the second time. Saving one resized photo to the Desktop gave
 * "can't open this folder because it contains system files".
 *
 * Chromium's blocked-path table lists the Desktop, the home folder, Documents
 * and Downloads as kDontBlockChildren: the folder itself is never handed over
 * as a directory, while anything written inside it is fine. So a directory
 * picker can never accept the Desktop however well the failure is handled, and
 * the first fix only handled the failure.
 */

test("one file is saved through a save dialog, not a folder picker", () => {
  assert.match(resizer, /showSaveFilePicker/, "one file still asks for a folder");
  assert.match(
    resizer,
    /files\.length === 1 && saver/,
    "the save dialog is not reserved for the single-file case",
  );
  // And the folder picker still exists, because several files are a folder.
  assert.match(resizer, /showDirectoryPicker/);
});

test("the save dialog is tried before the folder picker", () => {
  assert.ok(
    resizer.indexOf("showSaveFilePicker") < resizer.indexOf("const picker ="),
    "the folder picker runs first, so the Desktop is refused before the save dialog is reached",
  );
});

test("cancelling is told apart from being refused, on both paths", () => {
  // Cancel is a decision and gets no lecture; a refusal must not dead end.
  const aborts = resizer.match(/AbortError/g) ?? [];
  assert.ok(aborts.length >= 2, `only ${aborts.length} path(s) tell cancel apart from failure`);
});

test("nothing promises a folder we know the browser will refuse", () => {
  // "You pick the folder" was said for one file too, which promised something
  // the Desktop cannot do.
  assert.doesNotMatch(
    resizer,
    /1 file\$\{[^}]*\}\. You pick the folder\.|file\. You pick the folder\./,
    "one file is still offered a folder",
  );
  assert.match(resizer, /1 file\. You pick where it goes\./);
});

test("the busy state is always released", () => {
  // The button read "Saving" behind Chrome's own dialog. That part was right,
  // and it stays right only while every return path runs the finally.
  assert.match(resizer, /finally \{\s*setBusy\(false\);\s*\}/);
});
