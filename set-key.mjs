#!/usr/bin/env node
/**
 * Put a key into .env.local without it passing through anybody else.
 *
 *     npm run key
 *
 * You paste it into your own terminal. It is not shown as you type, it is never
 * printed back, and it goes into a file only you can read. Nothing about this
 * command puts the key into a chat, a log or a commit.
 *
 * Which is the whole reason it exists. A key pasted into a conversation has to
 * be rotated afterwards, and a key typed into a file by somebody else is a key
 * they have seen.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

const ENV = join(import.meta.dirname, ".env.local");

const KEYS = {
  anthropic: {
    name: "ANTHROPIC_API_KEY",
    from: "console.anthropic.com, API keys",
    looksLike: /^sk-ant-/,
    expect: "sk-ant-",
    why: "Needed before reading a website does anything.",
  },
};

const which = process.argv[2] ?? "anthropic";
const key = KEYS[which];
if (!key) {
  console.error("Unknown key. Try: " + Object.keys(KEYS).join(", "));
  process.exit(1);
}

/**
 * Ask for something without it appearing on screen. A key visible in a terminal
 * ends up in a screenshot, a screen share, or scrollback somebody else reads.
 */
function askHidden(question) {
  let hide = false;
  const muted = new Writable({
    write(chunk, encoding, done) {
      if (!hide) process.stdout.write(chunk, encoding);
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
    hide = true;
  });
}

console.log("\n" + key.name);
console.log("  " + key.why);
console.log("  Get it from: " + key.from);
console.log("  It will not appear as you type.\n");

const value = await askHidden("  Paste it here: ");

if (!value) {
  console.log("Nothing entered. Nothing changed.");
  process.exit(1);
}
if (!key.looksLike.test(value)) {
  console.log(
    "That does not look like an Anthropic key. They all start with " +
      key.expect + "\n" +
      "  Nothing was changed. Run npm run key again and paste the whole thing,\n" +
      "  including the sk-ant- at the front.",
  );
  process.exit(1);
}

const existing = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
const line = key.name + "=" + value;
const next = new RegExp("^" + key.name + "=", "m").test(existing)
  ? existing.replace(new RegExp("^" + key.name + "=.*$", "m"), line)
  : existing.replace(/\n*$/, "") + "\n" + line + "\n";

writeFileSync(ENV, next.replace(/^\n+/, ""), { mode: 0o600 });

console.log("Saved to .env.local. " + value.length + " characters, not shown.");
console.log("It is gitignored and readable only by you.\n");
console.log("Now:   npm run dev");
console.log("Then:  http://localhost:3000/try\n");
