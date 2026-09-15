import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, isPublic, safeNext, WORKS_WITHOUT_SUPABASE } from "../lib/routing.ts";

/**
 * Step 2 of the build: sign-in to workspace. These are the rules that decide
 * where a person lands, tested without a Supabase project, because testing them
 * by signing in over and over is slow and needs one.
 */

test("signed out, a protected page sends you to sign in and remembers where you were going", () => {
  assert.deepEqual(decide("/workspace", false), { go: "sign-in", next: "/workspace" });
  assert.deepEqual(decide("/workspace/competitor-tracker", false), {
    go: "sign-in",
    next: "/workspace/competitor-tracker",
  });
  assert.deepEqual(decide("/account", false), { go: "sign-in", next: "/account" });
});

test("signed out, the public pages are reachable", () => {
  for (const path of ["/", "/sign-in", "/not-invited", "/preview", "/auth/callback"]) {
    assert.deepEqual(decide(path, false), { go: "through" }, path);
  }
});

test("signed in, the landing page and the sign-in screen send you to your workspace", () => {
  // Showing "Sign in" to somebody who is signed in reads as broken.
  assert.deepEqual(decide("/", true), { go: "workspace" });
  assert.deepEqual(decide("/sign-in", true), { go: "workspace" });
});

test("signed in, everything else is left alone", () => {
  for (const path of ["/workspace", "/workspace/competitor-tracker", "/account", "/welcome"]) {
    assert.deepEqual(decide(path, true), { go: "through" }, path);
  }
});

test("the auth callback stays reachable while signed in, or the sign-in loops", () => {
  // It is the page that finishes signing you in. Bounce it to /workspace and
  // the session is never created, and the user is sent round again for ever.
  assert.deepEqual(decide("/auth/callback", true), { go: "through" });
  assert.deepEqual(decide("/auth/sign-out", true), { go: "through" });
});

test("a path that merely starts with a public one is not public", () => {
  // "/sign-ในsomething" must not be let through because it begins with /sign-in.
  assert.equal(isPublic("/sign-in-extra"), false);
  assert.equal(isPublic("/signup"), false);
  assert.equal(isPublic("/sign-in/anything"), true);
});

test("a redirect can only ever land inside this site", () => {
  // Without this, a link could sign somebody into our product and bounce them
  // somewhere else, carrying our name and their trust.
  for (const hostile of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "http://localhost:3000@evil.example",
    "/workspace\\@evil.example",
  ]) {
    assert.equal(safeNext(hostile), "/workspace", hostile);
  }
});

test("an ordinary next path is kept", () => {
  assert.equal(safeNext("/workspace/competitor-tracker"), "/workspace/competitor-tracker");
  assert.equal(safeNext("/account?tab=data"), "/account?tab=data");
});

test("no next at all falls back rather than throwing", () => {
  assert.equal(safeNext(null), "/workspace");
  assert.equal(safeNext(undefined), "/workspace");
  assert.equal(safeNext(""), "/workspace");
});

test("the pages that must work before Supabase exists are public", () => {
  // /try is the whole answer to "can I test this without authentication".
  // If it ever stops being public, that answer silently becomes no.
  for (const path of WORKS_WITHOUT_SUPABASE) {
    assert.equal(isPublic(path), true, path);
    assert.deepEqual(decide(path, false), { go: "through" }, path);
  }
});

test('"/" in the without-Supabase list does not let every path through', () => {
  // startsWith("/") is true of every path there has ever been. The proxy must
  // match "/" exactly, or the not-set-up answer never fires for anything.
  const passes = (path: string) =>
    WORKS_WITHOUT_SUPABASE.some((p) => path === p || path.startsWith(`${p}/`));
  assert.equal(passes("/"), true);
  assert.equal(passes("/sign-in"), true);
  assert.equal(passes("/try"), true);
  assert.equal(passes("/workspace"), false);
  assert.equal(passes("/account"), false);
  assert.equal(passes("/welcome"), false);
});
