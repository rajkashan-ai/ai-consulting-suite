# Build the Content & Social Planner

Paste this into a new session opened at
`/Users/rajashan/Desktop/CLAUDE/AI Consulting for Small Businesses`.

---

Build the Content & Social Planner so it runs live in the app, the way the
Competitor Tracker does. Work only in the files this says you own.

## Read first, in this order

1. `CLAUDE.md` sections 1.4, 1.4a, 1.4b, 1.4.8, 1.4.9 and 1.5. These are
   non-negotiable. 1.4b says exactly what a new tool costs and which files you
   must not touch.
2. `TESTING.md` section 7, the traps. Every one was paid for.
3. `Agents/Content & Social Planner/CLAUDE.md` — the tool's own spec: what it
   takes in, what it produces, the mix, the voice note, the screen.
4. `Agents/Content & Social Planner/memory.md` and `build-notes.md` — what that
   agent already learned.
5. `web/tools/competitor-tracker/` — the worked example. Read `stages.ts`,
   `index.ts`, `document.ts`, `scrub.ts`, `sources.ts`. Copy the shape, not the
   content.

## What already exists, and must be used rather than rewritten

`Agents/Content & Social Planner/src/` holds real, tested work:

- `plan-shape.ts` — the 30 day plan, cadence, which days carry a post
- `recommend.ts` — `recommendCadence`, the step up and step down thresholds
- `guards.ts` — `findPromisedResults`, `findUnsourcedReasons`,
  `validateRecommendation`
- `platform.ts`, `oembed.ts`, `tracking.ts`, `learning.ts`
- `tests/` and `evals/` — including an adversarial suite and a screen spec

The web app imports these directly, the way the tracker imports
`Agents/Competitor Tracker/src/`. Do not copy them into `web/`.

## What you own, and nothing else

- `web/tools/content-social-planner/` — new folder, everything you write
- `web/test/*.test.ts` — new files only, for this tool
- `web/supabase/content-planner-<date>-<what>.sql` — named, never numbered
- One line in `web/tools/registry.ts`: add your runner to `RUNNABLE`, and set
  `built: true` on the tool when it works

## Read-only. Ask, do not edit

`web/app/design.css`, `web/app/layout.tsx`, `web/app/workspace/chrome.tsx`,
`web/app/workspace/nav.tsx`, `web/lib/engine.ts`, `web/lib/watchdog.ts`,
`web/lib/plainly.ts`, `web/lib/research/`, and anything in
`web/tools/competitor-tracker/`.

If you need one changed, say so and stop. Another session owns them.

## The contract

Implement `ToolRun` from `web/tools/contract.ts` in
`web/tools/content-social-planner/index.ts`:

- `slug` — `content-social-planner`
- `advance(stage, state, business, ctx)` — one step, then stop. Never throws:
  fail the run instead. Each step saves, so a closed laptop loses nothing.
- `buildBody(state)` — the document to store
- `hollow(body)` — why it is not worth storing, or null
- `title(now)`
- `prepare` / `learn` — optional, only if the tool keeps anything between runs

The engine finds you through the registry. It knows nothing else about you.

## What "dynamic, like the competitor agent" means here

- **Stages**, not one long call. Small steps, each saving its state, so the
  watchdog can see progress and a run survives a closed tab.
- **Every claim carries a source**: the url and the date of a page actually
  read. A claim with nothing behind it is dropped, never reworded.
- **The model never writes a url.** Number the pages, let it cite by number,
  expand the number yourself. See `sources.ts`. A number it invents expands to
  nothing; an invented url does not.
- **Enforce shape in the JSON schema**, not in the prompt. A length asked for in
  prose is a length that drifts.
- **Nothing about our machinery reaches the screen.** No stage names, token
  counts or page numbers. `lib/plainly.ts` translates anything thrown.
- **Reading the web** obeys `CLAUDE.md` 1.5: robots, no cookies, one request at
  a time per host. Use `lib/research/fetch.ts`. Do not write your own fetch.

## Styling

You write none. Every colour, size and space is a token in `app/design.css`,
and a test refuses a hex or a `font-family` inside a tool. Use the existing
classes: `.band`, `.kpis`, `.kpi`, `.rows`, `.tag`, `.btn`, the table classes.
If something genuinely has no class, ask for one.

## How to work

- Build and test offline first, against saved fixtures. Only run live when the
  offline run is confident. A live run costs about a pound.
- Nothing you run touches real rows. Make a throwaway workspace, delete it.
- Before trusting a new test, break the thing it guards and watch it go red.
- Commit before breaking anything on purpose: `git checkout --` takes
  uncommitted work with it.
- `npx tsc --noEmit`, not `npm run typecheck`, while anything is running:
  the latter deletes `.next`.
- `npm test` must be green before every commit. It is 476 tests today.

## Never state a limit you have not tested

If you are about to write "cannot", "blocked", "not available" or "there is no way to", attempt it
first and report what you ran and what came back. Three such claims were made in one day and all
three were false. A limit sounds like honesty so nobody argues with it, which is exactly why it
needs evidence. It also silently decides what the customer is never offered.

## One correction to the spec, made 2026-09-16, read it before you build

The tool's own `CLAUDE.md` said "we cannot count what they post now". That was false and untested.
A public Instagram profile loads without signing in, and every post's date is encoded in its
shortcode. Measured on a real bakery: last posted one day ago, 6 posts in 30 days, 2.4 days
between them.

Section 2b is corrected. Read it. It changes the cadence recommendation from a guess against
nothing into a comparison against what they already do, which is what makes "step up" and "step
down" mean anything. Counting their current rate is part of the job now.

## Done means

A real business, entered at `/welcome`, gets a month of posts on the screen,
every claim sourced, in under five minutes, with `built: true` and the whole
suite green. Not before.
