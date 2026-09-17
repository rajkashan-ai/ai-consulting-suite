# Proposal & Quote Builder

> **Status:** defined 2026-09-14, not built. First draft from Gemini, reviewed and amended with Raj
> the same day. Decisions below are settled unless this file says otherwise.
>
> **Customer-facing name:** "Win the job" (the landing page's wording).
>
> Every tool prepends `Agents/_shared/base-prompt.md`. This file adds what is specific to this one.

---

## Header, as it appears in the app

**Proposal &amp; Quote Builder**

> Write professional quotes that win more of what you go after&mdash;turning messy discovery notes into structured, tiered proposals that eliminate client ghosting and scope creep.

_Set by Raj 2026-09-14. Customer-facing. The landing page names the same tool by its job,
which is deliberate: the page sells by problem, the app labels by tool._

> **This header overpromises, and Raj decided on 2026-09-14 to keep it and fix it before
> launch.** "eliminate client ghosting" is a promise about someone else's behaviour that nothing can keep. "tiered" is blanket, but tiers only appear where the category template calls for them. Do not treat it as a build spec.

---

## 1. Who it is for and what it answers

Someone who has to get something priced and sent tonight. They had the conversation, they have
messy notes, and the job now is turning that into something the customer says yes to.

## 2. The template library (decided 2026-09-14)

**This tool does not invent a document shape every time. It fills in a template for that category
of business.**

A plumber quoting a boiler needs one page: the price, what is included, what is not, and how to say
yes. A consultant proposing a project needs phases, tiers and a scope boundary. A clinic needs a
treatment plan. Same tool, different documents, and the difference is the category, not the prompt.

```
Agents/Proposal & Quote Builder/templates/
  trade-quote.md
  project-proposal.md
  ...one per category, added as real businesses arrive
```

**How the library grows.** When a business arrives in a category we have no template for, the tool
writes one and uses it in the same run. No waiting, no queue, no approval gate.

**The trade this makes, stated plainly so nobody is surprised by it.** The first business in a new
category is effectively getting a document generated from scratch, so the saving starts at business
number two. And a weak first template propagates to everyone in that category afterwards. The
mitigation is that templates are plain files: they can be read, corrected and improved, and a
complaint about one output is a complaint about one file rather than about the whole tool.

**Never reinvent a shape we already have.** If a template fits the category, use it.

## 3. What it takes in

| Input | Where it comes from |
|---|---|
| The business | Their profile, as everywhere else |
| The customer they are quoting | Named on screen |
| The conversation | Pasted notes, or an uploaded transcript. Read all of it (see §5) |
| **The prices** | **See §4. Never invented** |

## 4. Where the numbers come from (decided 2026-09-14)

**Pull from the Pricing tool. If it has not been run, ask.**

If they have set their prices and packages in Pricing & Packaging, those tiers and figures flow
straight in and the proposal is one click. If not, we work out the structure, the scope and the
boundaries from the notes, then ask for the figures before generating.

**A price is never invented, estimated, or inferred from what competitors charge.** We know what
five competitors charge from the battlecard, and it is tempting. It is also the most dangerous
thing this suite could do: a proposal becomes a contract the moment it is signed, and we do not
know their costs, their capacity, or what the job will actually take.

**In the first build there is no shared state**, so asking is the only path. That is the first real
argument for building Pricing before this one.

**Currency is theirs.** £ for a UK business. Never a default dollar.

## 5. Reading the notes

The conversation arrives messy: a rambling transcript, three pages of bullet points, a voice-to-text
dump with no punctuation. Read all of it.

**Read all of it, including the tail.** Work through long input in pieces and pull the pieces
together. Never truncate and never skim.

This used to say "the most important thing a client says is usually near the end, when they stop
performing and say the real reason they are worried." Marked on 2026-09-16 as an assumption, not a
finding: it is a claim about how people behave, it has no source, and nobody has counted it on our
own transcripts. It may well be true. It is not evidence, and a tool that believes it will weight
the tail of every transcript on nothing.

The instruction that survives it does not need it: read all of it, and do not skim. That holds
whether the belief is true or false. If we ever want the stronger version, count it on the
transcripts we have and cite the count.

**Pain before scope.** The document opens by restating what the customer said their problem is, in
their own words where possible. A proposal that opens with what we do rather than what they said
reads as a brochure.

## 6. What it produces

Whatever the category's template specifies. Across all of them, these rules hold.

**Scope boundaries are not optional.** What is not included, written plainly. This is the section
that protects them, and it is the one they would never write themselves.

**Tier names come from the business.** "Option C: Enterprise / Bespoke" is agency language. A
plumber does not have an Enterprise tier. If the template has tiers, name them in words that
business would use.

**Tiers only where they fit.** Three options on a £400 job is absurd and reads as upselling. The
template for that category decides.

**It ends with how to say yes.** One clear instruction, not a paragraph of next steps.

## 7. What it must never do

1. **Never invent a price**, a duration, a discount or a payment term. §4.
2. **Never invent what the customer said.** If it is not in the notes, it does not go in the
   executive summary. Putting words in a real client's mouth is how a deal dies in the first
   meeting after they read it.
3. **Never invent a credential, a case study, a named past client or a guarantee.**
4. **Never put a feedback prompt inside the proposal.** This one leaves the building and lands in
   front of the customer's customer. Same test as every other tool.
5. **Never truncate the notes.** §5.

## 8. Build notes for the first version

- No workspace switcher.
- One text area and one file upload. No "Client Name" plus five other fields.
- The button says what it does. Not "Generate High-Converting Proposal", which is a claim we cannot
  make about a document nobody has sent yet.
- Export as .docx, because this one gets edited before it is sent.

## 9. Open

1. **Uploads.** This is the tool that ingests transcripts, and those contain other people's names,
   prices and private conversations. Whether we store them, and for how long, is open question 3 in
   `memory.md` and it has to be answered before this ships, not after.
2. **The template library is a pattern, not a feature of this tool.** Battlecards and content plans
   could work the same way. Worth deciding whether it moves to `_shared`.
3. **Pricing before this one?** §4 makes the case.

## Never state a limit you have not tested (added 2026-09-16, applies to the whole suite)

A claim that something CANNOT be done is a factual claim and needs the same evidence as one that
says it can. "The prices are not readable", "Instagram blocks us", "there is no way to get the post
dates" were all said in one day and all three were wrong: the prices were on the page as `&pound;`,
the public profile loads without signing in, and Instagram encodes each post's date in its own
shortcode.

A limitation is never challenged, because it sounds like honesty rather than an assertion. That is
what makes it dangerous: an invented limit silently decides what the customer is never offered.

**Attempt it first. Report what you ran and what came back, not the conclusion alone.** If it truly
fails, say so with the evidence. See the suite `CLAUDE.md` 1.4.10 and the practice `CLAUDE.md` §1.
