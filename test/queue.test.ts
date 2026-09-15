import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { forgetQueues, queued } from "../lib/research/queue.ts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("two requests to the same site never overlap", () => {
  forgetQueues();
  let inFlight = 0;
  let worst = 0;

  const job = async () => {
    inFlight += 1;
    worst = Math.max(worst, inFlight);
    await wait(20);
    inFlight -= 1;
  };

  return Promise.all([
    queued("barber.co.uk", job),
    queued("barber.co.uk", job),
    queued("barber.co.uk", job),
  ]).then(() => {
    // The rule we owe a small business on shared hosting. If this ever reads 2,
    // we are hitting somebody's site twice at once.
    assert.equal(worst, 1, "same host must never run two at once");
  });
});

test("different sites do not wait for each other", async () => {
  forgetQueues();
  const began = Date.now();

  await Promise.all([
    queued("a.co.uk", () => wait(60)),
    queued("b.co.uk", () => wait(60)),
    queued("c.co.uk", () => wait(60)),
  ]);

  const took = Date.now() - began;
  // Serialised this is 180ms. In parallel it is about 60. The whole point of
  // the change: reading Booksy and a barber's own site at once harms neither.
  assert.ok(took < 140, `three different sites took ${took}ms, so they queued`);
});

test("one failure does not block everything after it on that host", async () => {
  forgetQueues();
  const order: string[] = [];

  const bad = queued("x.co.uk", async () => {
    order.push("bad");
    throw new Error("refused");
  });
  const good = queued("x.co.uk", async () => {
    order.push("good");
    return "ok";
  });

  await assert.rejects(bad);
  assert.equal(await good, "ok");
  assert.deepEqual(order, ["bad", "good"], "still in order, still one at a time");
});

test("the queue key must be the stripped domain, not the raw hostname", () => {
  // The bug this caught. fetch.ts computed `domain` with www removed and then
  // queued on `url.hostname` with it still there, so www.barber.co.uk and
  // barber.co.uk were two queues onto one machine and could run at once.
  //
  // Read as source, because the two keys behave identically in any test that
  // passes them the same string, which is how the first version of this test
  // passed while the bug was live.
  const src = readFileSync(join(import.meta.dirname, "..", "lib", "research", "fetch.ts"), "utf8");
  assert.match(src, /queued\(domain,/, "queue on the stripped domain");
  assert.ok(!/queued\(url\.hostname/.test(src), "never on the raw hostname");
});
