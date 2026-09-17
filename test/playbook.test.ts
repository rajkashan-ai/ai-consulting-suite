import { test } from "node:test";
import assert from "node:assert/strict";
import { confidence, exhausted, isDeadEnd, learn, needsATrade, startWith, type Playbook } from "../tools/competitor-tracker/playbook.ts";

const base: Playbook = {
  trade: "barber", platforms: [], publishes: [], deadEnds: [], evidence: [],
  timesUsed: 0, builtFrom: null, nothingIn: [], towns: [],
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

/**
 * A platform that has stopped listing a trade does not announce it. Its count
 * sits in the playbook at whatever it was the day it last worked, and every run
 * after that spends a search on it.
 */
test("a host we asked for twice and got nothing from is dropped", () => {
  const had: Playbook = {
    ...base,
    platforms: [{ host: "booksy.com", example: "https://booksy.com/s/barber", named: 70 }],
  };

  const once = learn(had, {
    platforms: [], publishes: [], deadEnds: [], evidence: [],
    town: "Shrewsbury", blank: ["booksy.com"],
  });
  assert.equal(once.platforms.length, 1, "one blank is a bad search, not a dead platform");
  assert.equal(once.platforms[0].blanks, 1);

  const twice = learn(once, {
    platforms: [], publishes: [], deadEnds: [], evidence: [],
    town: "Ludlow", blank: ["booksy.com"],
  });
  assert.equal(twice.platforms.length, 0, "two in a row and it goes");
});

test("a host that comes good has its blanks wiped", () => {
  const shaky: Playbook = {
    ...base,
    platforms: [{ host: "booksy.com", example: "https://booksy.com/s/barber", named: 70, blanks: 1 }],
  };

  // Coming good wipes the record: the count catches a platform that has
  // stopped, not one that had a bad week.
  const back = learn(shaky, {
    platforms: [{ host: "booksy.com", example: "https://booksy.com/s/barber/99", named: 40 }],
    publishes: [], deadEnds: [], evidence: [], town: "Ludlow", blank: [],
  });
  assert.equal(back.platforms[0].blanks, 0);
});

test("a host we never asked for is not punished for not turning up", () => {
  const had: Playbook = {
    ...base,
    platforms: [{ host: "booksy.com", example: "https://booksy.com/s/barber", named: 70 }],
  };
  const after = learn(had, {
    platforms: [], publishes: [], deadEnds: [], evidence: [], town: "Ludlow", blank: [],
  });
  assert.equal(after.platforms[0].blanks, undefined, "no search, no blank");
});

/**
 * Finding nothing is a fact about the trade, not a failure of the run. One town
 * settles nothing: a trade invisible in Ludlow may be all over Manchester.
 */
test("a trade is only settled as a dead end after three different towns", () => {
  let p = base;
  for (const town of ["Shrewsbury", "Ludlow", "Shrewsbury"]) {
    p = learn(p, {
      platforms: [], publishes: [], deadEnds: [], evidence: [], town, foundNothing: true,
    });
  }
  assert.deepEqual(p.nothingIn, ["Shrewsbury", "Ludlow"], "the same town twice is one town");
  assert.equal(exhausted(p), false);

  p = learn(p, {
    platforms: [], publishes: [], deadEnds: [], evidence: [], town: "Hereford", foundNothing: true,
  });
  assert.equal(exhausted(p), true);
});

test("a trade that found something is never settled, however many blanks", () => {
  const works: Playbook = {
    ...base,
    platforms: [{ host: "booksy.com", example: "https://booksy.com/s/barber", named: 70 }],
    nothingIn: ["a", "b", "c", "d"],
  };
  assert.equal(exhausted(works), false, "somewhere that works beats any number of empty towns");
});

/**
 * `timesUsed` counts runs, and three runs can all be the same town, so
 * "used 3 times across different towns" was a claim the data could not support.
 */
test("confirmed means different towns, not repeat runs in one", () => {
  let p = base;
  for (const town of ["Shrewsbury", "Shrewsbury", "Shrewsbury"]) {
    p = learn(p, {
      platforms: [{ host: "booksy.com", example: "x", named: 70 }],
      publishes: [], deadEnds: [], evidence: [], town,
    });
  }
  assert.equal(p.timesUsed, 3);
  assert.equal(confidence(p).level, "one town", "three runs in one town is still one town");

  p = learn(p, {
    platforms: [{ host: "booksy.com", example: "x", named: 70 }],
    publishes: [], deadEnds: [], evidence: [], town: "Ludlow",
  });
  p = learn(p, {
    platforms: [{ host: "booksy.com", example: "x", named: 70 }],
    publishes: [], deadEnds: [], evidence: [], town: "Hereford",
  });
  assert.equal(confidence(p).level, "confirmed");
  assert.match(confidence(p).say, /3 different towns/);
});

/**
 * Unmatched businesses are filed under their own words, so these rows are a
 * record of what the category list is missing.
 */
test("wording seen in three towns is flagged as a trade we are missing", () => {
  const twice: Playbook = { ...base, trade: "other:scaffolding-hire", towns: ["a", "b"] };
  const thrice: Playbook = { ...base, trade: "other:mobile-welding", towns: ["a", "b", "c"] };
  const real: Playbook = { ...base, trade: "barber", towns: ["a", "b", "c", "d"] };

  const flagged = needsATrade([twice, thrice, real]);
  assert.deepEqual(flagged.map((f) => f.words), ["mobile welding"]);
  assert.equal(flagged[0].towns.length, 3);
});

/**
 * A plain Set counted "St Albans" and "St. Albans" as two, so a playbook built
 * entirely in one town could call itself confirmed across three, which is the
 * exact claim the three-town rule exists to prevent.
 */
test("one town spelled two ways never becomes two towns", () => {
  let p = base;
  for (const town of ["St Albans", "St. Albans", "ST ALBANS"]) {
    p = learn(p, {
      platforms: [{ host: "booksy.com", example: "x", named: 70 }],
      publishes: [], deadEnds: [], evidence: [], town,
    });
  }

  assert.deepEqual(p.towns, ["St Albans"], "the same town was counted more than once");
  assert.equal(confidence(p).level, "one town", "three runs in one town read as confirmed");
});
