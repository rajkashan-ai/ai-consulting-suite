import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * On 15 September the sign-in screen failed in the browser with "Missing
 * NEXT_PUBLIC_SUPABASE_URL" while the variable was set. The cause was
 * `process.env[name]` with a variable key: Next substitutes the literal text
 * `process.env.NEXT_PUBLIC_X` and nothing else, so a computed lookup is never
 * replaced and is always undefined in a browser.
 *
 * It type checked, it built, and every server-rendered page was fine. Only
 * clicking the button found it. This reads the source instead, so the next one
 * is caught before anybody clicks.
 */
const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".next", "public", "test", "supabase"]);

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry) || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, found);
    else if (/\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

const files = sources(ROOT);

test("there are source files to check, so a broken walk cannot pass silently", () => {
  assert.ok(files.length > 15, `only found ${files.length} files`);
});

test("no file reads process.env through a variable", () => {
  const bad = files.filter((f) =>
    /process\.env\s*\[/.test(readFileSync(f, "utf8")),
  );
  assert.deepEqual(
    bad.map((f) => f.slice(ROOT.length + 1)),
    [],
    "process.env[x] is never substituted in browser code. Write the name out in full.",
  );
});

test("the public keys are written out in full where they are read", () => {
  const env = readFileSync(join(ROOT, "lib/supabase/env.ts"), "utf8");
  for (const name of [
    "process.env.NEXT_PUBLIC_SUPABASE_URL",
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]) {
    assert.ok(env.includes(name), `${name} must appear literally in env.ts`);
  }
});

test("the secret key never appears in a client component", () => {
  // A file marked "use client" is sent to the browser. The secret key ignores
  // Row Level Security, so it reaching one would hand over every customer.
  const clientFiles = files.filter((f) =>
    /^["']use client["']/m.test(readFileSync(f, "utf8")),
  );
  assert.ok(clientFiles.length > 0, "expected some client components");
  for (const f of clientFiles) {
    const text = readFileSync(f, "utf8");
    assert.ok(
      !/SERVICE_ROLE|SUPABASE_SECRET|secretKey|createAdminClient/.test(text),
      `${f.slice(ROOT.length + 1)} is a client component and must not touch the secret key`,
    );
  }
});

test("the no-sign-in reader refuses itself on a deployed site", () => {
  // It spends real money on whatever URL it is handed. On a public deployment
  // that is a bill anybody could run up. The guard is on the server action as
  // well as the page, because hiding a button is not refusing.
  for (const f of ["app/try/page.tsx", "app/try/actions.ts"]) {
    const text = readFileSync(join(ROOT, f), "utf8");
    assert.match(text, /NODE_ENV === "production"/, f);
    assert.match(text, /process\.env\.VERCEL/, f);
    assert.match(text, /notFound\(\)/, f);
  }
});

test("the no-email sign-in cannot exist on a deployed site", () => {
  // It hands out a real session. Three refusals, not one, because one is a
  // single careless edit away from being gone: production, any deploy on
  // Vercel including previews, and an explicit opt-in in .env.local.
  for (const f of ["app/api/dev-signin/route.ts", "app/sign-in/page.tsx"]) {
    const text = readFileSync(join(ROOT, f), "utf8");
    assert.match(text, /NODE_ENV [!=]== "production"/, `${f}: production check`);
    assert.match(text, /process\.env\.VERCEL/, `${f}: Vercel check`);
    assert.match(text, /ALLOW_DEV_SIGNIN/, `${f}: explicit opt-in`);
  }
});

test("the no-email sign-in still checks the allowlist", () => {
  // Skipping delivery is not the same as skipping who is allowed in, and this
  // is the assertion that stops the two being conflated later.
  const text = readFileSync(join(ROOT, "app/api/dev-signin/route.ts"), "utf8");
  assert.match(text, /allowed_emails/);
  assert.match(text, /not-invited/);
});
