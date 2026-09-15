#!/usr/bin/env node
/**
 * Put a key into .env.local without it passing through anybody else.
 *
 *     npm run key
 *
 * You paste it into your own terminal. It does not appear on screen, it is
 * never printed back, and it is written to a file only you can read.
 *
 * WHY THE HIDING IS DONE WITH stty AND NOT WITH READLINE
 * The first version muted readline's output stream while readline ran in
 * terminal mode. Terminal mode processes a paste keystroke by keystroke, and a
 * long paste arrived in pieces: a 108 character key was saved as 23 characters,
 * silently, and the only symptom was a 401 later. Turning the echo off at the
 * terminal itself and then reading one plain line keeps the paste whole.
 *
 * And the length is checked, so a truncated paste cannot be saved quietly ever
 * again.
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

const tty = process.stdin.isTTY;

function echo(on) {
  if (!tty) return;
  try {
    execFileSync("stty", [on ? "echo" : "-echo"], { stdio: ["inherit", "ignore", "ignore"] });
  } catch {
    /* not a terminal we can control. The paste still works, it is just visible. */
  }
}

function askLine(question) {
  return new Promise((resolve) => {
    // terminal:false, so the whole pasted line arrives as one line.
    const rl = createInterface({ input: process.stdin, terminal: false });
    process.stdout.write(question);
    rl.once("line", (line) => {
      rl.close();
      resolve(line.trim());
    });
  });
}

console.log("\n" + key.name);
console.log("  " + key.why);
console.log("  Get it from: " + key.from);
console.log(tty ? "  It will not appear as you paste. That is normal.\n" : "");

echo(false);
let value;
try {
  value = await askLine("  Paste it here, then press enter: ");
} finally {
  echo(true);
  process.stdout.write("\n");
}

const problem = check(value, key);
if (problem) {
  console.log(problem + "\n  Nothing was changed. Run it again.\n");
  process.exit(1);
}

const existing = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
const line = key.name + "=" + value;
const next = new RegExp("^" + key.name + "=", "m").test(existing)
  ? existing.replace(new RegExp("^" + key.name + "=.*$", "m"), line)
  : existing.replace(/\n*$/, "") + "\n" + line + "\n";

writeFileSync(ENV, next.replace(/^\n+/, ""), { mode: 0o600 });

console.log("  Saved. " + value.length + " characters, not shown.");
console.log("  .env.local is readable only by you and is never committed.\n");
console.log("  Now:   npm run dev");
console.log("  Then:  http://localhost:3000/try\n");

/** Every way a paste goes wrong, each with what to do about it. */
function check(value, key) {
  if (!value) return "  Nothing was pasted.";

  if (/\s/.test(value)) {
    return "  That has a space or a line break in it, so something else came with it.";
  }
  if (!value.startsWith(key.starts)) {
    return (
      "  That does not start with " + key.starts + ", so the front is missing.\n" +
      "  Select the whole key, including the " + key.starts + " at the start."
    );
  }
  if (value.length < key.minLength) {
    // This is the one that bit us: 23 characters saved silently, and the only
    // symptom was a 401 an hour later.
    return (
      "  Only " + value.length + " characters. A real key is about 100.\n" +
      "  The paste was cut short. Copy it again and paste the whole thing."
    );
  }
  return null;
}
