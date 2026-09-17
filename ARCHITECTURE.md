# Architecture review

**Status:** 2026-09-17. First review. Same shape as `ERROR-HANDLING.md`, and for the same reason:
an opinion in a conversation is re-derived every time it is asked about and lands somewhere
slightly different. This is scored against published standards and against measurements taken from
the running product, so asking again means reading rows rather than forming a view.

**The standard** is quoted with its source and does not move. **What we do** is a choice, with the
reason. **Measured** is a number taken from the product, with the date. Read the difference.

---

## 1. Instruction files are over Anthropic's own limit

### The standard

> "**Size**: target under 200 lines per CLAUDE.md file. Longer files consume more context and
> reduce adherence."

And on the fix:

> "Splitting into `@path` imports helps organization but doesn't reduce context, since imported
> files load at launch."

> "Rules can be scoped to specific files using YAML frontmatter with the `paths` field... **only
> load into context when Claude works with matching files**, reducing noise and saving context
> space."

Source: <https://code.claude.com/docs/en/memory>

### Measured, 2026-09-17

| File | Was | Now | Loads |
|---|---|---|---|
| `CLAUDE.md` | 351 | **189** | Every session |
| `Agents/Content & Social Planner/CLAUDE.md` | 403 | **189** | When that folder is read |
| `Agents/Competitor Tracker/CLAUDE.md` | 212 | **185** | When that folder is read |
| `UI/CLAUDE.md` | 225 | **171** | When UI files are read |
| Every other agent spec | 125 to 163 | unchanged | On demand |

All under the target as of 2026-09-17. Four path-scoped rules in `.claude/rules/`, and a
`references/` folder beside each spec that was split. Nothing was cut: every moved section is whole,
with a note saying where it came from.

### What that costs

The root file is the one that matters: it is in context at the start of every session in every
tool's build, and Anthropic's own guidance says a file this size reduces adherence to itself. Which
is a plausible partial explanation for something observed repeatedly: rules 1.4.8, 1.4.9 and 1.4.10
were all written after breaking the rule they now state, and two of them were broken again later
the same day.

The heaviest sections are the two that are least often needed:

| Section | Lines | Needed when |
|---|---|---|
| 1.6 Skills, and which one owns what | 64 | Choosing a skill |
| 1.5 Getting data off the web, legally | 63 | Writing a fetch, which two of six tools ever do |

### What to change

Move 1.5 into `.claude/rules/web-fetching.md` with `paths: ["web/lib/research/**", "web/tools/**"]`,
and 1.6 into `.claude/rules/skills.md`. Both then load only when the matching files are touched.
That is roughly 127 lines out of every session where they are not relevant, and the root file lands
near 220.

**Not** `@path` imports: the documentation is explicit that those still load at launch and save
nothing.

---

## 2. Prompt caching is not used, and it is the largest single lever

### The standard

| | Relative to base input |
|---|---|
| Cache read | **0.1x** |
| Cache write, 5 minute life | 1.25x |
| Cache write, 1 hour life | 2x |

Minimum cacheable prefix: 512 tokens on Opus 5, 1,024 on Sonnet 5. Below that nothing is cached and
no error is raised.

> "Place `cache_control` on the **last block that stays identical across requests**."

Recommended for caching: system instructions, background context, tool definitions, large
documents.

Source: <https://platform.claude.com/docs/en/build-with-claude/prompt-caching>

### Measured

`grep -rn "cache_control" web/lib web/tools` returns nothing. Every call sends its whole prompt at
full price, every time.

A competitor run makes up to seven model calls. Two of them, the grid areas, carry an identical
system prompt and an identical evidence pile and differ only in one sentence naming the area. The
narrative call carries the same system prompt again. The mend pass carries it a fourth time.

From the one run today that succeeded end to end, the bakery at 14:24:

| Stage | Input tokens | Calls |
|---|---|---|
| searching | 51,759 | 1 |
| writing | 29,713 | 3 |
| **Run total** | **81,472** | |

### What to change

Put `cache_control` at the end of the system prompt in `lib/engine.ts`, which is the single place
every call goes through. The system prompt is static, is shared by every writing call, and is well
over the 512 token minimum.

**Estimate, and it is an estimate:** the system prompt is sent on at least three calls per run and
would be paid for at 0.1x on the second and third. The evidence pile is sent twice by the grid and
cannot be cached between the two, because they run in parallel and neither has finished to populate
a cache when the other starts. That is a real trade: parallelism was bought deliberately to halve
wall clock, and it costs the cache.

**What is not an estimate:** we currently pay 1.0x for content the documentation says can be paid
for at 0.1x, and nothing in the code has ever tried.

### What to measure before believing any of this

The response carries `cache_creation_input_tokens` and `cache_read_input_tokens`. Neither is
recorded today. Record both in `watch.cost` first, then change one call, then compare. Anything
else is arithmetic on a guess.

---

## 3. One file is 15% of the codebase

### Measured

| File | Lines | Share of app code |
|---|---|---|
| `web/tools/competitor-tracker/stages.ts` | **2,481** | **15%** |
| `web/tools/sources/uk-directories.ts` | 857 | 5% |
| `web/tools/content-social-planner/stages.ts` | 850 | 5% |
| Everything else in `app`, `lib`, `tools` | 11,896 | 74% |

`stages.ts` holds 36 top-level declarations: seven stage functions, the schemas, the prompts, the
grid areas, and a dozen helpers.

### Why it matters here, with evidence rather than principle

Today, four separate faults were found in that one file: the naming stage accepting a Pennsylvania
barber, the reuse path not reading the owner's own website, the watchdog limit being checked too
rarely to interrupt a long step, and the grid buying its evidence once per area. Each needed the
whole file read to understand, and three of them were found by writing a test rather than by
reading.

There is no published line limit worth citing, and a rule invented here would be my opinion. What
is not opinion: the same file changed in eight of today's commits, which makes it the collision
point in a design whose stated aim, in `CLAUDE.md` 1.4b, is six tools built in six sessions without
collisions.

### What to change

Split along the seams that already exist, one file per stage, since each stage is already a
function with a single entry point and its own state. The schemas and prompts move to their own
files. This is mechanical and behaviour-preserving, and 708 tests make that checkable.

---

## 4. Speed: where the time actually goes

### Measured, the St Albans run of 14:33, which the watchdog stopped at 20 minutes

| Stage | Seconds | What it was doing |
|---|---|---|
| searching | 256.8 | Five web searches |
| listings | 219.4 | Reading two listing pages, extracting 192 businesses |
| reading | 5.9 | Fetching four competitor pages |
| choosing | 0.2 | Ranking, pure code |
| writing | 513.1 | Three model calls |

And the successful bakery run at 14:24, for contrast: 73.1 seconds of working time in total.

### What that says

Discovery was 476 of 995 seconds and has since been removed: asking a model who competes and then
verifying the names replaced the crawl. That change is committed and tested and **has never run
live**, so the saving is expected rather than observed.

Writing is now the largest stage and is bounded by output tokens, which generate at roughly a
hundred a second. Cutting the grid from four areas to two halved the output the clock waits on.

**The remaining structural problem is not speed, it is the gap between wall clock and working
time.** That run was 1,246 seconds on the clock and 995 working. Roughly four minutes were spent
not working, between steps, because the browser drives the loop one request at a time.

---

## 5. What is missing

Each of these is absent, not merely thin, and each was found by looking rather than by reasoning.

| Missing | Evidence it matters |
|---|---|
| **A resume** | A stopped run starts from zero. 434,000 tokens were discarded on 2026-09-16 and immediately re-spent |
| **Cache token accounting** | `cache_read_input_tokens` is never recorded, so section 2 cannot be verified after it is built |
| **Cost accounting that adds up** | A stage killed mid-step never folds its cost back: 205,576 recorded against 434,033 actually spent, an undercount of 53% |
| **A remote** | `git remote -v` is empty. One disk, no backup |
| **Retention on `problems`** | It grows forever. Other tables have a retention rule; this one was not included |
| **Authorisation logging beyond refusals** | OWASP lists twelve categories, we cover three. See `ERROR-HANDLING.md` |
| **Any live run of the rebuilt pipeline** | Everything in section 4's "expected" column |

---

## 6. What is good, and should not be changed to look tidier

Said explicitly, because a review that lists only faults invites rewriting things that work.

- **The tool contract.** `web/tools/contract.ts` means the engine knows nothing about any tool.
  Adding the Content Planner touched one line of the registry.
- **Pure code where judgement is not needed.** `choosing` and `checking` make no model call and cost
  nothing. That instinct should be extended, not reversed.
- **Evidence numbering.** The model cites a page by number and we expand it. A number it invents
  expands to nothing; an invented url would not.
- **Stages that each save.** A closed laptop loses nothing, and it is why the watchdog can measure
  working time at all.
- **The fetcher owning politeness.** One request at a time per host is enforced where the fetch
  happens, so no caller can be rude by accident.

---

## The order, and why this one

1. **A remote.** Five minutes. The only item where the downside is losing everything: 389 tracked
   files, both decision records and the six agent specs sit on one disk with no copy. Everything
   else here is an optimisation.
2. **Record cache token counts.** An hour, and without it section 2 is unverifiable.
3. **Move 1.5 and 1.6 to path-scoped rules.** An hour, and it is Anthropic's own guidance about
   their own product.
4. **Cache the system prompt.**
5. **Split `stages.ts`.** Mechanical, and the tests make it safe.
6. **One live run**, which now proves three things at once: that the rebuilt pipeline works, that
   caching is happening, and exactly what it saved.

**Why the live run is last, having first been put third.** Nothing in 4 or 5 depends on it. Caching
does not care whether the naming stage works, and splitting a file is behaviour-preserving with 708
tests behind it. Putting the run earlier needed two runs, one to observe the rebuild and another to
observe the caching. With cache counts recorded first, the response carries
`cache_read_input_tokens` itself, so a single run answers both questions in the same pound.

Corrected by Raj on 2026-09-17, and recorded rather than quietly changed, because the first ordering
came from an instinct that unverified things should be verified early rather than from anything
downstream needing it.

Resume is deliberately not on the list at all. It is the largest piece of work here, and once a run
is 90 seconds rather than 20 minutes, restarting costs a fraction of what it did.

---

## Changelog

- **2026-09-17** Written. Measurements taken the same day from the running product and from the
  runs table. Nothing here is implemented.
- **2026-09-17** Items 2, 3, 4 and 5 done. Cache tokens are recorded apart from ordinary input.
  The system prompt is cached, verified live: a first call wrote 6,852 tokens and a second read all
  6,852 back. Sections 1.5 and 1.6 moved to `.claude/rules/`, taking CLAUDE.md from 351 lines to
  252. `stages.ts` split from 2,481 to 2,035 by lifting out the prompts and the schemas. Six tests
  broke in that split, all of them pinned to a filename rather than to what they were checking, and
  they now read the tool's whole folder.
- **2026-09-17** Order corrected. The live run moved from third to last, because nothing in caching
  or splitting depends on it and a single run after both answers more than two runs around them.
  The remote moved from last to first: it is the only item whose downside is losing the work.
