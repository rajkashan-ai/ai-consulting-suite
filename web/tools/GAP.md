# What the two finished tools are still missing

Written 15 September 2026, after reading both.

## What exists, and it is a lot

**Competitor Tracker**: 337 tests. The fetch policy, the weekly cadence with its
clock-skew cases, the five-competitor set with add and replace, review parsing
with name redaction, search visibility, positioning and prediction validation,
the Meta ad library probe, and `validateBattlecard`, which runs eleven separate
guards over a finished card.

**Content & Social Planner**: 349 tests. The plan shape and its dates, cadence
recommendation with step up and step down, voice critique and rewrite, oembed
caption fetching, tracking summaries, learning capture, and `validatePlan`.

Both have a `wiring.test.ts` that reads its own source and fails if a guard is
written but never called. That caught `findRankClaims`, which had five passing
tests and ran on nothing. That is a better test than most production code has.

## What is missing

**Nothing in either one reads a page or asks the model.** I checked: no
`fetch`, no Anthropic client, no model name, anywhere in either `src/`.

So there is no function that takes a business and returns a battlecard or a
plan. `validateBattlecard` takes a `Battlecard` that something else has to have
produced. Nothing produces one.

Both `CLAUDE.md` files still open with **"Status: defined 2026-09-14, not
built"**, which is accurate.

## What has to be written, for each

One function, matching `run` in `types.ts`:

```ts
run: async (business, ctx) => { ... return { title, sections } }
```

Inside it, the steps neither tool has yet:

**Competitor Tracker**
1. Find candidate competitors. `buildSearchTerms` says what to search for and
   `candidatesFromSearch` classifies results, but something has to do the
   searching.
2. Read each one's pages with `ctx.read`, and their booking pages, which is
   where the prices actually were in the Shrewsbury test.
3. Turn those pages into a `Battlecard` with `ctx.think`.
4. Run `validateBattlecard` over it and refuse to show anything that fails.
5. Turn the card into `sections`.

**Content & Social Planner**
1. Read the business's own site with `ctx.read` to get the voice and the
   services.
2. Build the shape with `planDates` and `recommendCadence`, which both exist.
3. Write the posts with `ctx.think`.
4. Run `validatePlan` and refuse anything that fails.
5. Turn the plan into `sections`.

Steps 1, 2 and 5 are mechanical. Step 3 is the actual tool, and step 4 is
already written and waiting.

## What the workspace now does with their code

Rather than write any of that, the workspace calls what is there:

- `tools/cadence.ts` calls their `decideRun` for the weekly rule, and turns the
  reason code into a sentence a customer reads. It does not reimplement "is it
  seven days", because the Competitor Tracker's own build notes warn about
  exactly that: the Swap-in box reimplemented `candidate.ts` inline and the two
  copies contradicted each other within hours.
- Imports across the folder boundary work now. `next.config.ts` sets the
  Turbopack root to the project root, because Turbopack will not resolve
  anything above its own folder and the error is a bare "Module not found" on a
  file that is plainly there.
- Imports need the `.ts` extension. Node's type stripping requires it and
  Turbopack accepts it. Without it, the tests cannot load the module.
