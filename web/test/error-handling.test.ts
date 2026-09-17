import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The checks ERROR-HANDLING.md commits to.
 *
 * That file says these are checks and not opinions, and this is what makes that
 * true. A rule written down and enforced nowhere is a rule until the next
 * person is in a hurry.
 */

const root = join(import.meta.dirname, "..");

function everySource(dir: string, found: { path: string; body: string }[] = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) everySource(path, found);
    else if (/\.tsx?$/.test(entry)) found.push({ path, body: readFileSync(path, "utf8") });
  }
  return found;
}

const sources = ["app", "lib", "tools"].flatMap((d) => everySource(join(root, d)));
const shortName = (p: string) => p.slice(root.length + 1);

// ---------------------------------------------------------------------------
// Check 1: no error is discarded
// ---------------------------------------------------------------------------

/**
 * CWE-390, "Detection of Error Condition Without Action": the product detects a
 * specific error but takes no action. Its mitigations give three options, and
 * "carry on silently" is not one of them.
 *
 * ERROR-HANDLING.md adds a fourth, narrow one: expected and uninteresting, with
 * a correct fallback. That one is allowed and must say so, which is what this
 * checks. A silent catch with no explanation is the weakness.
 */
test("every silent catch says why it is silent", () => {
  const offenders: string[] = [];

  for (const { path, body } of sources) {
    const lines = body.split("\n");

    lines.forEach((line, i) => {
      // `} catch {` with no error binding: the error object is gone entirely.
      if (!/}\s*catch\s*\{\s*$/.test(line.trim())) return;

      // A reason, in the three lines after it or the three before. Either a
      // comment or a call that does something with the situation.
      const near = lines.slice(Math.max(0, i - 3), i + 4).join("\n");
      const explained = /\/\/|\/\*|\*/.test(near);

      if (!explained) offenders.push(`${shortName(path)}:${i + 1}`);
    });
  }

  assert.deepEqual(
    offenders,
    [],
    `These throw the error away and do not say why:\n  ${offenders.join("\n  ")}\n` +
      `See ERROR-HANDLING.md rule 1. Either handle it, tell somebody, or write ` +
      `one line saying it is expected.`,
  );
});

// ---------------------------------------------------------------------------
// Check 2: nothing personal reaches a record
// ---------------------------------------------------------------------------

test("the recorder takes no field that could hold a person", () => {
  // OWASP's never-log list, applied at the shape of the thing rather than by
  // remembering at each call site. A field that cannot be passed cannot leak.
  const body = readFileSync(join(root, "lib", "problems.ts"), "utf8");
  const type = body.slice(body.indexOf("export type Problem"), body.indexOf("export type Notes"));

  for (const banned of ["email", "ip", "userId", "user_id", "token", "password", "session"]) {
    assert.doesNotMatch(
      type,
      new RegExp(`\\b${banned}\\b`, "i"),
      `Problem accepts "${banned}". See ERROR-HANDLING.md rule 3.`,
    );
  }
});

test("the recorder redacts before it writes, not after", () => {
  const body = readFileSync(join(root, "lib", "problems.ts"), "utf8");
  assert.match(body, /import \{ redact \}/, "nothing strips contact details");

  // In messageOf, which every path goes through, rather than only at one caller.
  const messageOf = body.slice(body.indexOf("export function messageOf"));
  assert.match(messageOf.slice(0, 1_200), /redact\(/, "redaction is not on the shared path");
});

// ---------------------------------------------------------------------------
// Check 3: the framework hooks exist and reach the recorder
// ---------------------------------------------------------------------------

test("the three Next.js hooks exist", () => {
  for (const file of ["app/error.tsx", "app/global-error.tsx", "instrumentation.ts"]) {
    assert.ok(existsSync(join(root, file)), `${file} is missing. An uncaught error has nowhere to go.`);
  }
});

test("each hook actually reports, rather than only showing a message", () => {
  const reports: Record<string, RegExp> = {
    // Client Components, as the docs require, so they post rather than write.
    "app/error.tsx": /\/api\/problem/,
    "app/global-error.tsx": /\/api\/problem/,
    // Server side, so it writes directly.
    "instrumentation.ts": /note\(/,
    "app/api/problem/route.ts": /note\(/,
  };

  for (const [file, wanted] of Object.entries(reports)) {
    const body = readFileSync(join(root, file), "utf8");
    assert.match(body, wanted, `${file} handles the error but records nothing. That is CWE-390.`);
  }
});

test("global-error carries its own html and body, as the docs require", () => {
  // It replaces the root layout rather than sitting inside it, so without these
  // it renders nothing at all, which is the one case where it matters most.
  const body = readFileSync(join(root, "app", "global-error.tsx"), "utf8");
  assert.match(body, /<html/);
  assert.match(body, /<body/);
});

test("a run that threw is recorded as a fault, not only on its own row", () => {
  // runs.state.watch.stopped held the reason for that one run, so nobody could
  // tell a fault that happened once from one happening to everybody.
  const body = readFileSync(join(root, "lib", "engine.ts"), "utf8");
  assert.match(body, /noteProblem\(/, "a thrown run is still invisible outside its own row");
});

// ---------------------------------------------------------------------------
// Check 4: nothing about our machinery reaches the screen
// ---------------------------------------------------------------------------

test("the error pages write their own words, never the error's", () => {
  /**
   * CLAUDE.md 1.4: two readers. `say` for the customer, `why` for us. An error
   * page is exactly where that gets broken, because the error is right there
   * and rendering it feels helpful.
   */
  for (const file of ["app/error.tsx", "app/global-error.tsx"]) {
    const body = readFileSync(join(root, file), "utf8");
    const rendered = body.slice(body.indexOf("return ("));

    assert.doesNotMatch(rendered, /\{\s*error\.message\s*\}/, `${file} shows the raw message`);
    assert.doesNotMatch(rendered, /\{\s*error\.digest\s*\}/, `${file} shows the digest`);
    assert.doesNotMatch(rendered, /\{\s*error\.stack\s*\}/, `${file} shows the stack`);
  }
});

// ---------------------------------------------------------------------------
// Check 5: the browser is not a blind spot
// ---------------------------------------------------------------------------

/**
 * Error boundaries do not catch errors in event handlers or in async work after
 * a render. The Next.js docs say so plainly, and that is most of what a button
 * does. So `error.tsx` existing proves nothing about a click.
 *
 * The one that cost the most was the run loop: it caught a failed step, waited
 * four seconds and retried, for as long as the tab stayed open. Nothing
 * recorded, nothing on screen but "Running".
 */
test("every client component that catches an error either reports it or says why not", () => {
  const offenders: string[] = [];

  for (const { path, body } of sources) {
    if (!/^["']use client["']/m.test(body)) continue;
    if (!/}\s*catch/.test(body)) continue;

    // Either it reports, or every catch in the file explains itself. The second
    // is allowed: a url that will not parse is not worth a round trip.
    const reports = /\breport\(/.test(body);
    if (reports) continue;

    const silent = body
      .split("\n")
      .map((line, i) => ({ line: line.trim(), i }))
      .filter(({ line }) => /}\s*catch\s*(\(|\{)/.test(line))
      .filter(({ i }) => {
        const near = body.split("\n").slice(Math.max(0, i - 3), i + 5).join("\n");
        return !/\/\/|\/\*|\*/.test(near);
      });

    if (silent.length) offenders.push(`${shortName(path)}:${silent[0].i + 1}`);
  }

  assert.deepEqual(
    offenders,
    [],
    `Client components catching errors with no report and no explanation:\n  ` +
      `${offenders.join("\n  ")}\nSee ERROR-HANDLING.md rule 1 and check 5.`,
  );
});

test("a loop that retries our own server gives up and says so", () => {
  /**
   * Retrying forever is not resilience when the thing being retried is ours.
   * A wobbly connection recovers in one or two attempts; a broken endpoint
   * never does, and the customer watches a spinner until they close the tab.
   */
  const body = readFileSync(join(root, "app", "workspace", "[tool]", "running.tsx"), "utf8");

  /**
   * The catch itself, not the whole file.
   *
   * Written first as three matches against the file, which passed with the
   * limit declared and never used: a constant can sit there looking like a
   * guard while the loop it names retries forever. The assertions have to be
   * about the code that runs.
   */
  const caught = body.slice(body.indexOf("} catch (e) {"), body.indexOf("if (!alive.current) return;"));
  assert.ok(caught.length > 0, "the retry loop no longer catches at all");

  assert.match(caught, /refused\s*\+=\s*1/, "nothing counts consecutive failures");
  assert.match(caught, /refused\s*===\s*GIVE_UP_AFTER/, "the limit is declared but never reached");
  assert.match(caught, /report\(/, "it gives up without recording why");
  assert.match(caught, /setFailed\(/, "it gives up without telling anybody");
});

test("signing in is not a silent failure", () => {
  // OWASP lists authentication failures as a thing to log, and it is the one
  // failure where the person affected cannot tell us: they are not in yet.
  const body = readFileSync(join(root, "app", "sign-in", "form.tsx"), "utf8");
  assert.match(body, /report\(/, "a customer who cannot sign in leaves no trace");
});

test("severity reaches the record from every path that knows it", () => {
  for (const [file, wanted] of [
    ["app/error.tsx", /severity: "stopped"/],
    ["app/global-error.tsx", /severity: "stopped"/],
    ["lib/engine.ts", /severity: "stopped"/],
    ["app/api/problem/route.ts", /SEVERITIES/],
  ] as const) {
    assert.match(readFileSync(join(root, file), "utf8"), wanted, `${file} records no severity`);
  }
});

/**
 * A page that threw was recorded as an ordinary fault.
 *
 * Found on 2026-09-17 by causing a real render crash rather than handing the
 * recorder an error: everything through `onRequestError` defaulted to the
 * middle severity, and a blank page is not the middle answer. The customer
 * lost what they came for.
 */
test("a render that threw is recorded as stopping the customer", () => {
  const body = readFileSync(join(root, "instrumentation.ts"), "utf8");

  assert.match(
    body,
    /severity:\s*context\.routeType === "render" \? "stopped"/,
    "a page that would not load is filed as an ordinary fault",
  );
  assert.match(body, /action:/, "nothing says what was being attempted");
  assert.match(body, /outcome:/, "nothing says whether it worked");
});
