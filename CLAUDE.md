# CLAUDE.md: AI Small Business Consulting Suite

> **What this is.** The root instruction file for a paid web product: six AI consulting tools for
> businesses with 1 to 20 people, in one workspace they log into.
>
> **How we build. Not what the product says.** Customers never see this file. What they experience
> is `Agents/_shared/base-prompt.md`, which every tool prepends. Edit this one when the way we build
> changes, that one when the product's behaviour changes.
>
> **This folder stands on its own** (moved out of the consulting practice, 2026-09-14). No
> instruction file above it loads, so these are the only project rules in force. One rule we keep
> from the practice: plain English, no em dashes, no buzzwords, nothing that reads AI-generated.
>
> **Status:** v2 (2026-09-14). Root files only. No code yet.

---

## 1.1 What we are building

A web app an owner signs up for, describes their business once, then uses every tool against that
one profile. Folders are in 1.3.

| Tool | What it produces |
|---|---|
| Competitor Tracker | Five competitors side by side, every claim sourced and dated, plus what changed |
| Content & Social Planner | A 30 day plan of finished posts, written in their voice, at a cadence they choose |
| Proposal & Quote Builder | A quote or a proposal from a category template, with scope boundaries and their prices |
| Lead Capture & Funnel Builder | A website audit from a real render, the lead magnet itself, page copy, three emails |
| Pricing & Package Builder | A rate card from their costs and the market, plus the words for telling a client |
| Process & SOP Builder | A step by step process from a brain dump, every assumption flagged in the text |

They are not equally hard. Proposal, Pricing and SOP are text in, text out and work on day one.
Competitor Tracker needs live web data, where the cost, the flakiness and the legal edges live, and
it does not cover traffic (1.5). Funnel Builder reads the customer's real site. Price accordingly.

## 1.2 Stack (decided 2026-09-14)

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript + Tailwind |
| Auth, database, file storage | Supabase (Postgres, Auth, Storage) |
| AI | Anthropic API. `claude-sonnet-5` by default, `claude-opus-5` where synthesis is genuinely hard |
| Payments | Stripe |
| Hosting | Vercel |

Boring on purpose. Every part of this is debuggable by two people.

## 1.3 Folder structure

```
/ (this folder)
├── CLAUDE.md          this file
├── memory.md          build memory: decisions, progress, open questions
├── TESTING.md         how we prove it works, does what it says, and holds up
├── UI/                the app. CLAUDE.md defines the workspace round the tools
└── Agents/
    ├── Competitor Tracker/               CLAUDE.md (prompt spec) + memory.md (what we learned)
    ├── Content & Social Planner/
    ├── Proposal & Quote Builder/
    ├── Lead Capture & Funnel Builder/
    ├── Pricing & Package Builder/
    └── Process & SOP Builder/
```

**One internal name per tool.** Folder, file title and the header in the app all match, so there is
only ever one name to search for. The landing page sells each tool by its job instead, and that
wording is set by testing, so it will differ on purpose. Spaces are fine in folders we only read,
but every path inside `UI/` that lands in an import or a URL must be lower case with hyphens.

Each agent folder holds its `CLAUDE.md` (that tool's definition and output contract) and `memory.md`
(real examples, failure modes, prompt changes). Both exist from the day a tool is defined, so the
first thing learned has somewhere to go.

## 1.4 Build rules

1. **One tool at a time, finished.** A tool is done when a real owner used it and the output was
   good enough to send. Six half-working tools is a product nobody pays for twice.
2. **API keys never reach the browser.** All Anthropic calls run server side, in route handlers.
3. **Every account's data is separate.** Row level security on every table from the first
   migration, never retrofitted. A test proves it, not a policy (`TESTING.md` 4).
4. **Know the cost of every call.** Log tokens and cost per run. A tool that costs more than the
   customer pays is a leak, not a feature.
5. **Prompts live in the agent folders, not scattered in code.** The app loads them. One place to
   change behaviour.
6. **Stream long outputs.** A month of written posts takes time, and a spinner loses the user.
7. **Every generated document is saved.** So the customer can return to it, and so we can see what
   the tool really produced when they complain.
8. **Nothing we run for our own purposes touches real rows.** Added 2026-09-15. A test, a
   measurement, a one-off script: each makes its own throwaway business, works in that, and
   deletes it. Never point one at the live tables, not even to read, because the next version of
   the same script writes. On 2026-09-15 a watchdog test aged a real run's `started_at` by twenty
   minutes to see the deadline fire. It worked, and it destroyed the only record of how long the
   successful run had taken, so Raj's own figure could not be checked against anything. That was
   an afternoon's evidence. The same mistake against a paying customer deletes their work.
9. **Print the raw thing beside the number, every time.** Added 2026-09-15. Before reporting that
   something is broken, fixed or faster, print the actual object next to the claim: the real field
   names, the real first row. On 2026-09-15 a check script read `areas` where the product writes
   `claims`, and reported five competitors with no data in them. The run was perfect. Raj was told
   his product was broken and would have spent the next hour on a fault that did not exist. The
   raw print goes in the working output always; it goes in front of Raj only for those three
   claims, because he has asked twice for less to read and he is right.
10. **Never state a limit you have not tested.** Added 2026-09-16. "Instagram blocks us", "the
    prices genuinely are not readable" and "I cannot get the post dates" were all said in one day
    and all three were wrong: the prices were on the page under an HTML entity, the Instagram
    profile reads fine without signing in, and the post dates are encoded in the shortcodes. A
    limit sounds like modesty, so nobody argues with it, which is exactly why it has to be
    evidenced like anything else. Attempt it first. If it really fails, report what you ran and
    what came back. An invented limit is an invented fact, and it silently decides what the
    customer is never offered.

## 1.4d Architecture (added 2026-09-17)

**`ARCHITECTURE.md` is the review, scored against published standards and against measurements
from the running product.** Read it before a structural change. It says what is measured, what the
standard says, and what we chose, and it keeps the three apart so the answer is the same next time.

Its four live findings, with the evidence in the file:

1. This file is 351 lines against Anthropic's own "target under 200", and sections 1.5 and 1.6
   belong in `.claude/rules/` where they load only when the matching files are touched.
2. Prompt caching is used nowhere. Cache reads cost 0.1x of base input.
3. `stages.ts` is 2,481 lines, 15% of the codebase, and changed in eight of one day's commits.
4. A stopped run restarts from zero. 434,000 tokens were discarded and re-spent on 2026-09-16.

Order: a git remote first, since it is the only one whose downside is losing the work, then cache
accounting, the rules split, caching itself, the file split, and one live run at the end that
proves all of it at once.

## 1.4c Errors (added 2026-09-17)

**`ERROR-HANDLING.md` is the decision. Read it before touching a `catch`, an `error.tsx` or
anything that fails.** It separates what the standard says, with the source, from what we chose,
with the reason. It exists because the same question got two different answers from me an hour
apart, and a decision that lives in a conversation is reinvented every time it is asked about.

The short version, and the file has the evidence:

1. **No error is discarded.** Every `catch` fixes and retries, tells the customer and continues,
   tells the customer and stops, or is expected and says so in a comment. `} catch {` with no
   binding and no comment is a bug. This is CWE-390, a named weakness, not a style preference.
2. **Two readers.** `say` for the customer, `why` for us. Both kept.
3. **Never record an email, an IP or a token**, and never a run's state wholesale: it holds page
   text read off somebody's website.
4. **Recording is not preventing.** Every fault that gets recorded and fixed gets a test in the
   same commit.

## 1.4a Readable by an owner, not just correct (added 2026-09-16)

Moved to `.claude/rules/readable-output.md` on 2026-09-17. It governs what a customer reads,
so it loads when a session touches the code that produces it.

## 1.4b Six tools, six sessions, no collisions (added 2026-09-16)

Moved to `.claude/rules/parallel-sessions.md` on 2026-09-17. It says which files a session owns,
and it loads when a session opens one of them, which is the moment it matters.

## 1.5 Getting data off the web, legally

Moved to `.claude/rules/web-fetching.md` on 2026-09-17, where it loads only when a session
touches the files it governs. Same rules, unchanged: robots is the gate, no cookies, one
request at a time per host, and a block is never worked around.

## 1.6 Skills: what we use, and which one owns what

Moved to `.claude/rules/skills.md` on 2026-09-17.

## 1.7 Adding a new tool

1. Write `Agents/<Tool>/CLAUDE.md`: who it is for, what it takes in, what it produces, the output
   contract, what it must never do. That contract is what the tests check.
2. Write the acceptance criteria as tests, before building. Method in `TESTING.md`.
3. Build the route and the UI page.
4. Run it against three real businesses. Read every output yourself.
5. Record what broke in `Agents/<Tool>/memory.md`.
6. It is finished only when it clears the seven checks in `TESTING.md` section 6.

## 1.8 Closing task, every session

1. **Update `memory.md`:** what got built, what was decided and why, what is next, what is open.
2. **Add the tests.** A bug becomes a test before it is fixed. A feature arrives with its criteria
   as tests. A customer complaint becomes an eval case. No test is ever deleted to go green. Name
   which test covers what was built, or say plainly that none does yet. Method: `TESTING.md`.

---

## 1.9 Decisions and open questions

Recorded in `memory.md`. If this file and `memory.md` disagree, this file defines how we build and
`memory.md` holds where we got to.
