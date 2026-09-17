import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { advance, type RunState } from "../tools/competitor-tracker/stages.ts";
import { notYou } from "../tools/competitor-tracker/sift.ts";
import { normaliseName } from "../../Agents/Competitor Tracker/src/normalise.ts";
import { aBusiness, fakeContext, type Recorded , ownerAgrees} from "./fake.ts";

/**
 * Written by an independent tester.
 *
 * The product is sold to UK small businesses of one to twenty people. Plenty of
 * them trade under a name that is not written in the Latin alphabet: an Arabic
 * barbershop, a Chinese takeaway, a Polish shop. Nothing in the requirement
 * says those are out of scope.
 */

const recorded = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures", "shrewsbury.json"), "utf8"),
) as Recorded;

const RIVALS = [{ name: "NO.1 BARBERS" }, { name: "ARMANDO Barbershop" }, { name: "Brotherhood Barbers" }];

test("breakit: a name that is not Latin script does not normalise to nothing", () => {
  const cases = ["محل الحلاقة", "理髮店", "Перукарня", "Κουρείο"];
  for (const name of cases) {
    assert.notEqual(normaliseName(name), "", `${name} normalises to an empty string`);
  }
});

test("breakit: the customer's own name never removes their competitors", () => {
  // notYou drops a row whose normalised name contains the customer's. When the
  // customer's normalises to "", every string contains it, so everybody goes.
  for (const you of ["محل الحلاقة", "理髮店", "Перукарня", "The Company", "😀"]) {
    assert.deepEqual(
      notYou(RIVALS, you).map((r) => r.name),
      RIVALS.map((r) => r.name),
      `a business called "${you}" lost every competitor it had`,
    );
  }
});

test("breakit: a barber with an Arabic trading name can finish a run", async () => {
  const { ctx } = fakeContext(recorded, {
    think: {
      comparison: { comparison: recorded.grid },
      battlecard: {
        competitors: [{ name: "ARMANDO Barbershop", claims: {} }],
        where_you_win: [],
        where_they_win: [],
        actions: [1, 2, 3].map((rank) => ({
          rank,
          area: "pricing",
          headline: `Publish a price for job ${rank}`,
          why: "Four of the five publish one and you do not.",
          evidence: [
            {
              text: "Four of the five publish a classic cut price on Booksy",
              value: 4,
              source: {
                url: "https://booksy.com/en-gb/s/barber/1227928_shrewsbury",
                fetchedOn: "2026-09-15",
              },
            },
          ],
        })),
      },
    },
  });

  let state: RunState = {};
  let stage = "searching" as never;
  for (let i = 0; i < 30; i++) {
    const step = await advance(stage, state, aBusiness({ name: "محل الحلاقة" }), ctx);
    stage = step.stage as never;
    state = ownerAgrees(step) as RunState;
    if (stage === "done" || stage === "failed") break;
  }

  assert.notEqual(
    stage,
    "failed",
    `the run failed for a business whose only difference is its name: ${state.reason}`,
  );
});
