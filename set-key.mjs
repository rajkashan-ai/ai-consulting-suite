#!/usr/bin/env node
/**
 * Put a key into .env.local, without it passing through anybody else and
 * without it having to survive being pasted into a terminal.
 *
 *     Copy the key, then:  npm run key
 *
 * WHY IT READS THE CLIPBOARD
 * Two attempts at reading a pasted key both truncated it. Muting readline in
 * terminal mode chopped a 108 character key to 23. Turning echo off at the
 * terminal and reading one line did better and still cut it short in the
 * terminal Raj uses. Terminals handle long pastes in their own ways and this
 * one loses characters.
 *
 * The clipboard does not have that problem. pbpaste hands over the whole thing
 * in one piece, no keystrokes involved, nothing to truncate. The key never
 * appears on screen, is never echoed, and is never printed back.
 *
 * Typing it in is still there as a fallback for anyone without a clipboard,
 * with the length checked, so a short one can never be saved silently.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";

const ENV = join(import.meta.dirname, ".env.local");

const KEYS = {
  anthropic: {
    name: "ANTHROPIC_API_KEY",
    from: "console.anthropic.com, then API keys",
    starts: "sk-ant-",
    minLength: 60,
    why: "Needed before reading a website does anything.",
  },
};

const which = process.argv[2] ?? "anthropic";
const key = KEYS[which];
if (!key) {
  console.error("Unknown key. Try: " + Object.keys(KEYS).join(", "));
  process.exit(1);
}

console.log("\n" + key.name);
console.log("  " + key.why);
console.log("  Get it from: " + key.from + "\n");

const copied = fromClipboard();
let value = extract(copied, key);
let how = "clipboard";
const tidied = Boolean(copied && value && copied.trim() !== value);

const clipboardProblem = value ? check(value, key) : null;
if (clipboardProblem) {
  // Something is on the clipboard but it is not a key. Say what is wrong with
  // it rather than only that it is wrong: the reason is nearly always the
  // shortened label rather than a bad copy, and those need different fixes.
  console.log("  What is on your clipboard is not a usable key.\n");
  console.log(clipboardProblem + "\n");
  process.exit(1);
}

if (!value) {
  console.log("  No Anthropic key on the clipboard, so type it instead.");
  console.log("  It will not appear as you type.\n");
  value = extract(await typeIt(), key) ?? "";
  how = "typed";
}

const problem = check(value, key);
if (problem) {
  console.log("\n" + problem + "\n  Nothing was changed. Run it again.\n");
  process.exit(1);
}

const existing = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
const line = key.name + "=" + value;
const next = new RegExp("^" + key.name + "=", "m").test(existing)
  ? existing.replace(new RegExp("^" + key.name + "=.*$", "m"), line)
  : existing.replace(/\n*$/, "") + "\n" + line + "\n";

writeFileSync(ENV, next.replace(/^\n+/, ""), { mode: 0o600 });

if (tidied) {
  console.log("  Found the key inside what you copied, and ignored the rest.");
}
console.log("  Saved from your " + how + ".");
console.log("  " + value.length + " characters, which is the right length. Not shown.");
console.log("  .env.local is readable only by you and is never committed.\n");
console.log("  Now:   npm run dev");
console.log("  Then:  http://localhost:3000/try\n");

// ---------------------------------------------------------------------------

/**
 * Find the key inside whatever was copied.
 *
 * Rejecting anything with a space in it was strict where it should have been
 * helpful. A key copied out of a browser regularly arrives wrapped across two
 * lines, or with a label in front of it, or with a stray newline on the end.
 * None of that is a broken key, it is a normal copy, and refusing it sends
 * somebody back to the website for no reason.
 *
 * A key has no spaces inside it, so whitespace is removed and then the key is
 * picked out of whatever is left. Anything before or after it is ignored.
 */
function extract(text, key) {
  if (!text) return null;
  const squashed = text.replace(/\s+/g, "");
  const found = squashed.match(new RegExp(key.starts + "[A-Za-z0-9_-]+"));
  return found ? found[0] : null;
}

/** macOS puts the clipboard on stdout. Nothing is printed, it goes to a string. */
function fromClipboard() {
  for (const [cmd, args] of [
    ["pbpaste", []],
    ["wl-paste", ["--no-newline"]],
    ["xclip", ["-selection", "clipboard", "-o"]],
  ]) {
    try {
      const out = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const trimmed = out.trim();
      if (trimmed) return trimmed;
    } catch {
      /* not on this machine */
    }
  }
  return null;
}

function typeIt() {
  const hush = (on) => {
    try {
      execFileSync("stty", [on ? "echo" : "-echo"], { stdio: ["inherit", "ignore", "ignore"] });
    } catch {
      /* no terminal to control */
    }
  };
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, terminal: false });
    process.stdout.write("  Key: ");
    if (process.stdin.isTTY) hush(false);
    rl.once("line", (l) => {
      rl.close();
      if (process.stdin.isTTY) hush(true);
      process.stdout.write("\n");
      resolve(l.trim());
    });
  });
}

/** Every way this goes wrong, each saying what to do about it. */
function check(value, key) {
  if (!value) {
    return (
      "  No Anthropic key found in it. A key starts with " + key.starts + "\n" +
      "  and is about 100 characters with no spaces."
    );
  }
  if (value.length < key.minLength) {
    // Nearly always the same cause, so name it rather than describing the
    // symptom. The console shows the real key once, in the dialog after you
    // create it. Afterwards the list shows a shortened label, about this
    // length, which looks like a key and is not one.
    return (
      "  Only " + value.length + " characters. A real key is about 100.\n\n" +
      "  You have almost certainly copied the shortened version the console\n" +
      "  shows in the list of keys. That is a label, not the key.\n\n" +
      "  The real one is shown once, in the box right after you press Create\n" +
      "  key, and there is a copy button in that box. Press the button rather\n" +
      "  than selecting the text. Once that box is closed it cannot be shown\n" +
      "  again, so make a new key and delete the old one."
    );
  }
  return null;
}
