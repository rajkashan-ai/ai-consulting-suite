import { test } from "node:test";
import assert from "node:assert/strict";
import { confidence, isDeadEnd, learn, startWith, type Playbook } from "../tools/competitor-tracker/playbook.ts";

const base: Playbook = {
  trade: "barber", platforms: [], publishes: [], deadEnds: [], evidence: [],
  timesUsed: 0, builtFrom: null,
};

test("where to look first is how many it named, not how famous it is", () => {
  const p = {
    ...base,
    platforms: [
      { host: "famous.com", example: "x", named: 2 },
      { host: "obscure.com", example: "y", named: 70 },
    ],
  };
  assert.deepEqual(startWith(p), ["obscure.com", "famous.com"]);
});

test("a platform that worked stops being a dead end", () => {
  // Sites come back. A permanent blacklist from one bad afternoon is how a tool
  // slowly stops finding anything.
  const had = { ...base, deadEnds: [{ host: "booksy.com", why: "refused us" }] };
  const now = learn(had, {
    platforms: [{ host: "booksy.com", example: "u", named: 70 }],
    publishes: [], deadEnds: [], evidence: [], town: "Shrewsbury",
  });
  assert.equal(now.deadEnds.length, 0);
  assert.equal(isDeadEnd(now, "https://booksy.com/x"), null);
});

test("counts are replaced, not averaged", () => {
  // A platform that named seventy last week and two today has changed. An
  // average would hide it quietly dying.
  const had = { ...base, platforms: [{ host: "b.com", example: "u", named: 70 }] };
  const now = learn(had, {
    platforms: [{ host: "b.com", example: "u", named: 2 }],
    publishes: [], deadEnds: [], evidence: [], town: "Bristol",
  });
  assert.equal(now.platforms[0].named, 2);
});

test("one town is said to be one town", () => {
  assert.equal(confidence(null).level, "none");
  const once = learn(base, {
    platforms: [{ host: "b.com", example: "u", named: 70 }],
    publishes: ["prices"], deadEnds: [], evidence: [], town: "Shrewsbury",
  });
  assert.equal(confidence(once).level, "one town");
  assert.match(confidence(once).say, /Shrewsbury/);
});

test("it becomes confirmed only after several towns", () => {
  let p = base;
  for (const town of ["Shrewsbury", "Bristol", "Leeds"]) {
    p = learn(p, {
      platforms: [{ host: "b.com", example: "u", named: 40 }],
      publishes: [], deadEnds: [], evidence: [], town,
    });
  }
  assert.equal(confidence(p).level, "confirmed");
  // The town it was first worked out in is not overwritten by later ones.
  assert.equal(p.builtFrom, "Shrewsbury");
});

test("evidence does not grow for ever", () => {
  let p = base;
  for (let i = 0; i < 20; i++) {
    p = learn(p, {
      platforms: [], publishes: [], deadEnds: [],
      evidence: [{ url: `https://x/${i}`, on: "2026-09-15", what: "listing" }, { url: `https://y/${i}`, on: "2026-09-15", what: "listing" }],
      town: "T",
    });
  }
  assert.equal(p.evidence.length, 30);
  assert.equal(p.evidence[0].url, "https://x/19", "newest first");
});
