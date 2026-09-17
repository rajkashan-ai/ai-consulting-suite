---
paths:
  - "**/*.md"
  - ".claude/**"
---

<!-- Moved out of CLAUDE.md on 2026-09-17. 64 lines about choosing a skill,
     needed when choosing a skill and not when writing a stage. See
     ARCHITECTURE.md section 1. -->

# Skills: what we use, and which one owns what

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
