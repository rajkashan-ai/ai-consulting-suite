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

Correct and unreadable is not done. The first finished comparison was accurate in
every cell and Raj's verdict was "at present I wouldn't read it". Every fault in it
maps onto a published heuristic, so we use the published ones rather than inventing
house rules: **Nielsen's 10 Usability Heuristics** for the interface
(`nngroup.com/articles/ten-usability-heuristics/`), and **SVPG** for what we choose to
build, in particular that the test of a feature is whether a real user can get value
from it unaided, not whether it shipped.

The four we broke, and the rules that come out of them:

1. **Say a thing once.** (Nielsen 8, aesthetic and minimalist design: "interfaces
   should not contain information that is irrelevant or rarely needed".) Every cell
   printed its source and date, thirty repetitions of the same eight words in one
   table. Repeated support belongs in the header, the footer, or a footnote. It moves,
   it does not go: a claim nobody can check is a claim nobody believes.
2. **A row exists to be read across.** (Nielsen 6, recognition rather than recall.)
   The comparable fact is first and loudest in every cell, in the same place in each,
   and numbers use `tabular-nums` so digits sit under digits. Comparing two prices must
   never mean reading two sentences and holding them in your head.
3. **A heading is the answer, not the label.** People read the heading and stop. "You
   put five prices in plain sight" is a label. "You publish 5 prices, they publish 2"
   is the finding. Cap it in the schema, because a length asked for in prose drifts.
4. **Never show our own references.** (Nielsen 2, match between the system and the real
   world.) "(page 3)" is our machinery: the reader cannot see page 3. This is section
   7.7 of `UI/CLAUDE.md` in another costume.

**Enforce it on the shape, not in the prompt.** A cell that must be short gets
`maxLength` in its JSON schema. Asking politely produced full sentences every time.

**Every one of these has a test** in `web/test/readable.test.ts`, asserting both the
shape we ask the model for and what the screen does with it. Both have to hold: a
short value rendered badly is still unreadable, and a beautiful table full of
sentences is still unreadable.

Apply all of this to the other five tools before they are built, not after.

## 1.4b Six tools, six sessions, no collisions (added 2026-09-16)

Each tool is meant to be built independently. What stopped that, and what each
one now costs:

1. **The engine named the tool.** It imported the Competitor Tracker's stages,
   playbook and document, and wrote its slug into the row, so every new tool
   meant editing `lib/engine.ts` and two sessions collided on their first
   commit. The engine now looks the tool up by the slug already on the run and
   calls the contract in `tools/contract.ts`. It names no tool, and a test in
   `test/contract.test.ts` fails if it ever does again.

2. **A tool owns its folder and nothing else.** `tools/<slug>/` holds its
   stages, its document, its own tests and its own fixtures. A tool importing
   another tool's files makes two sessions dependent without either touching a
   shared file, so a test forbids it.

3. **Migrations are named, not numbered.** A running number means two sessions
   both write `013` and one silently loses. Name them
   `<tool>-<date>-<what>.sql`. The already-applied numbered ones keep their
   names: renaming would make them all look unapplied.

4. **Some files are read-only to a tool session.** `app/design.css`, the tokens,
   `app/layout.tsx`, the workspace shell, `lib/engine.ts`, `lib/watchdog.ts`,
   `lib/plainly.ts` and the guards. A tool that needs one changed asks rather
   than changing it. This is the lock `UI/CLAUDE.md` 6c already describes,
   applied to `web/`.

**What a new tool costs, in full:** one folder, one line in
`tools/registry.ts`, and `built: true` when it works. Nothing else.

**Styling is never a tool's business.** Every colour, size and space is a token
in `app/design.css`, and a test refuses a hex or a `font-family` inside a tool.
See 1.4a.

## 1.5 Getting data off the web, legally

Only Competitor Tracker and Funnel Builder touch the web. Same rules for both.

**Where facts may come from**

| Source | Cost | Notes |
|---|---|---|
| The competitor's own public pages | Free | Logged out only. Pricing, services, case studies |
| **Booksy** venue pages | Free | For anyone who takes bookings, the richest single source there is: every price and review count on one page. `robots.txt` **disallows `/search/`**, so we never crawl their search |
| **Fresha** venue pages | Free | Same shape. `/search*` disallowed, venue pages allowed, salons sitemap published |
| Claude API web search tool | $10 per 1,000 searches | Anthropic runs it. Domain allow and block lists |
| Claude API web fetch tool | Tokens only | Only fetches URLs already in the conversation |
| Companies House API (UK) | Free | Filed accounts and officers. Official open data |
| Meta Ad Library API | Free | Every ad a rival is running now, word for word, with its start date. The only source that says what a competitor pays to say rather than where they show up. Needs an identity confirmation at `facebook.com/ID`, 2 to 7 days, and nothing else. **Whether GB returns commercial ads is unsettled and decides the feature.** Steps and the probe that settles it: `Agents/Competitor Tracker/ad-library-access.md` |
| Google Ads Transparency Center | Free | Thinner, no mature API |
| Google Places API | Paid per call | Reviews shown live with attribution, never stored. Place IDs may be kept, coordinates 30 days |
| Trustpilot API | Paid | Their API only. Scraping Trustpilot is banned in their terms and actively blocked |
| Similarweb or Semrush | $125 to $549 a month | Not used. The only lawful source of a rival's traffic mix, and we chose not to buy it |
| Checkatrade | | **Not used.** Returns 403 to us |
| TikTok Commercial Content Library | Free | **Not used.** Covers the UK, and both doors are shut: `library.tiktok.com/robots.txt` disallows `/api`, `/ads` and the whole site, and the official API is gated to academics and non-profits |
| LinkedIn Ad Library | Free | **Not used.** Their `robots.txt` prohibits automated access without written permission. Ask at `whitelist-crawl@linkedin.com` if we ever take on B2B customers |
| Google Ads Transparency Centre | Free | **Not used.** No API and no `robots.txt`. The page is 2.5MB of JavaScript and 159 characters of text, so there is nothing to read |
| Snapchat, Pinterest, X ad libraries | Free | **Not used.** Commercial tiers are EU only, and the UK is out of scope since Brexit |

**Booking platforms are the first place to look, and their search is out of bounds.** Both Booksy
and Fresha let us read a named venue's page and neither lets us crawl their search results
(`robots.txt`, checked 14 September 2026). So the platform never tells us *who* the competitors are.
Finding them is Claude web search or Google Places; the platform is then read one venue page at a
time. **Before launch, read both sets of terms of use.** `robots.txt` being clear is not the same as
the terms allowing it, and Trustpilot is the precedent: a site can permit the crawl and ban the use.

**How the crawler behaves**

1. `robots.txt` is the gate. Disallowed means we do not fetch it.
2. Logged out only. Never a login, a paywall, a captcha, or an IP rotated to dodge a block.
3. Identify ourselves in the user agent, with a URL explaining who we are.
4. One request at a time per site, with a pause between. We are not a load test.
5. Read and summarise. Never store or reproduce substantial copied text: copyright applies, and the
   UK kept the database right after Brexit.
6. Reviews give themes, never named individuals. Under UK GDPR "it was public" is not a lawful basis.
7. Every stored fact carries its URL and the date it was fetched.
8. Honour any takedown request the same day, and keep a way to block a domain permanently.

**No traffic data (decided 2026-09-14, corrected 2026-09-16).** This said a competitor's traffic
mix "cannot be obtained lawfully", which is false: it can, by buying a Similarweb or Semrush
licence, and plenty of people do. What is true is that **we have not bought one, and an estimate
from anyone is still an estimate.** So the product does not offer it, nothing may estimate, infer or
imply it, and if a customer asks we say we do not have that data. That is a choice about cost and
honesty, not a law, and the screen already words it correctly.

Corrected under 1.4.10: the original sentence was a limit nobody had tested, and it would have
stopped us even considering a licence if the product ever needed one.

**Cost of one competitor run, measured 2026-09-16.** About $1.10 to $1.25. The last clean run was
179,000 input and 15,000 output tokens plus five web searches: roughly $1.07 of it is the writing
stage on Opus, $0.10 the searching and listing work on Sonnet, $0.05 the searches themselves.

Input roughly doubled when the grid split into four parallel calls, which halved the time. Prompt
caching on the shared evidence would buy most of that back and has not been done.

The old estimate here was $0.50 to $2.00 "until measured". It is measured.

## 1.6 Skills: what we use, and which one owns what

A skill is a written method Claude Code loads when needed. They help us **build**. They do not run
inside the product: see the end of this section.

**Nothing to install per tool.** They live in `~/.claude/skills/`, so every folder under this one
already has them. A subagent is the exception: it reaches them only if its definition grants it the
`Skill` tool.

### Wired in at root, for the whole build

| Skill | What it does, plainly | When it should fire |
|---|---|---|
| `owasp-security` | Checks code for the standard security holes: broken login, leaked data, unsafe input | Before any code touching login, customer data, uploads or payments is done. Again before launch |
| `claude-api` | The current reference for calling the Claude API: model names, prices, streaming, tools | Before writing or changing any API call. Never write that code from memory, the API moves |
| `code-review` | Reads the diff for real bugs and code that could be simpler | On the diff, before anything is called done |
| `panel` | Puts 5 or 6 invented buyer personas in front of something, separately, and scores it | Before anything a customer sees ships: landing page, pricing, onboarding, tool output |
| `no-ai-speak` | Finds the tells that make writing read as machine-written, and rewrites them out | On any copy we publish. It is also the source of the product's own writing rules, below |
| `instruction-audit` | Reads instruction files too long to be followed and proposes cuts | When a file passes 200 lines or 12,000 characters, or when rules are visibly ignored |
| `session-handoff` | Writes a short note so the next session starts from 40 lines, not the whole transcript | Only when pausing mid-task |
| `go-faster` | Splits a job so parts run at once | Before a big multi-part push |
| `agent-setup` | Installs guard rails: warns if a secret is written to a file, or instructions outgrow their cap | Once, if we add those guards here |

### Used on one tool only, never at root

| Skill | Which tool | Why it stays there |
|---|---|---|
| `company-research` with `research-once` | Competitor Tracker | Verify, register, date and grade every fact. Irrelevant to the other five |
| `seo-audit` | Lead Capture & Funnel Builder | A website audit from a real render, the lead magnet itself, page copy, three emails |

### Things that look like duplicates, settled

| Looks like a clash | Who owns it | Why |
|---|---|---|
| `research-once` and `company-research` | Both. They compose | `company-research` says to follow `research-once` for register mechanics. One owns the method, one owns `SOURCES.md` |
| `code-review` and `simplify` | `code-review` | `simplify` is quality only and points at `code-review` for bugs. Running both runs one twice |
| `panel` and the two code checkers | `panel` for anything a customer sees, the others for code | `panel` states it is not for source code |
| `agent-setup` and `instruction-audit` | `agent-setup` before, `instruction-audit` after | One sets the caps, the other fixes files that grew past them |
| `session-handoff` and our `memory.md` | `memory.md` owns decisions and state. `HANDOFF.md` is only a mid-task pause note | A decision never goes in `HANDOFF.md`, it goes in `memory.md` |
| `no-ai-speak` and the product's writing rules | `no-ai-speak` is the source | The product holds a marked copy, because code cannot call a skill |
| the practice's `research` skill and `company-research` | Neither, here | The practice skill writes consultancy research packs into client folders. Not this product |

### The product does not call a skill today, and that is a choice

This said "the product cannot call a skill". Checked against the Claude API docs on 2026-09-16 and
it is **false**: the Claude API supports custom Skills, uploaded through the `/v1/skills` endpoints
and referenced by `skill_id`, and on the API they are workspace-wide.

Two real constraints, which are the reasons to keep what we do rather than the reasons we imagined:

- Skills on the API need the **code execution tool**, whose container they run in. That is a
  dependency our runs do not otherwise have.
- That container has **no network access**. Our tools read the live web, so anything that must
  fetch stays in our own code whatever we do with skills.

So today our server sends a system prompt and nothing is inherited: no `CLAUDE.md`, no skills
folder. Anything all six tools must do lives in the one file they all prepend,
`Agents/_shared/base-prompt.md`: the writing rules copied out of `no-ai-speak` and the sourcing
rules from 1.5, each marked as a copy pointing at its original. Change them there, once.

**That remains the right call for now, and it is now a decision rather than an assumption.** Worth
revisiting if the copies ever drift from their originals, which is the failure this arrangement
risks.

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
