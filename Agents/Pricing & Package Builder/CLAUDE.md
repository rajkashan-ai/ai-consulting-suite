# Pricing & Package Builder

> **Status:** defined 2026-09-14, not built. First draft from Gemini, reviewed and amended with Raj
> the same day. Keep the first build simple and let real output show what is missing.
>
> **Customer-facing name:** "Price your work" (the landing page's wording).
>
> Every tool prepends `Agents/_shared/base-prompt.md`. This file adds what is specific to this one.

---

## Header, as it appears in the app

**Pricing &amp; Package Builder**

> Price your work properly so you stop guessing and stop undercharging&mdash;building confident, tiered packages anchored in real market data and true client value.

_Set by Raj 2026-09-14. Customer-facing. The landing page names the same tool by its job,
which is deliberate: the page sells by problem, the app labels by tool._

---

## 1. Who it is for and what it answers

"I'm charging by the hour and I'm too cheap." They have never raised their prices because they have
no idea what to raise them to, and no words to say when a client asks why.

## 2. What makes a price real, and what we have to ask

A price is real when it sits between a floor and a ceiling you can defend.

| What it needs | Where it comes from |
|---|---|
| What the market charges, the anchor | The battlecard. Five competitors, sourced and dated |
| **What the work costs them to deliver, the floor** | **Ask** |
| **What they charge now, the reality check** | **Ask** |
| What it is worth to the customer, the ceiling | Inferred from what competitors promise and what the job is |

**Two questions before it runs (decided 2026-09-14), and we say why.**

> We need two numbers. Roughly what you charge for a typical job now, and roughly what that job
> costs you to do. Without the second one we could talk you into a price that loses you money.

This is the only form in the suite. Every other tool infers or asks named options. This one cannot,
because nothing on a website tells you what a job costs to deliver, and **without the floor we can
confidently recommend a price that loses them money on every job they win.** That is the one output
in this product that could genuinely damage a business.

People answer a question when they understand the reason for it. Give the reason.

## 3. What it produces

Keep the first build to this. Add when real use shows a gap.

```
## Where you are now
   Their current price against the five competitors, with sources and dates.
   Their margin at today's price, from the two numbers they gave.

## What to charge
   Tiers, named in their words. The price for each, and one line on why that number.
   Never more tiers than the business needs.

## What to say when they ask
   The words for telling an existing client the price has changed, and for quoting the
   new price to someone new without apologising for it.
```

**The script is the part that makes this work.** Knowing the right price changes nothing if they
cannot say it out loud. This section is not a nice extra, it is the one that gets used.

**Tier names come from the business.** "Essential / Growth / Bespoke" is agency language. A plumber
does not sell a Bespoke tier.

**Tiers only where they fit.** Three tiers on a one-service business is invention. If the shape is
one price and a couple of add-ons, say that.

**Currency is theirs.** £ for a UK business.

## 4. What it must never do

1. **Never recommend a price below the cost they gave us.** Hard floor. If the market rate is under
   their cost, that is the finding: they are in a race they cannot win at that cost, and the answer
   is a different offer, not a lower price.
2. **Never invent their costs, their margin, or their current price.** If they did not give it,
   we do not have it.
3. **Never present a competitor's price without its source and the date we read it.** Prices move,
   and a stale number in a pricing decision is worse than no number.
4. **Never put a feedback prompt inside the rate card.** Same test as every other tool.
5. **Never dress a guess as a calculation.** If a number rests on an assumption, name the
   assumption in the same sentence.

## 5. Build notes for the first version

- No workspace switcher.
- Two number fields and one named-options question about their current model. Nothing else.
- Competitor prices come from the battlecard if it has been run. If not, the tool says it is
  working without market data and the output is weaker. It does not go and fetch them itself in
  this build.
- The button says what it does.
- Export as .docx. This gets edited.

## 6. Open

1. **Target income.** A third number, what they want to be earning or how many jobs a week they can
   do, would let the output say whether the new price actually gets them there rather than just
   that it is defensible. Left out to keep the ask small. Add it if the output feels thin.
2. **Add-ons.** The draft had an upsell menu. Left out of the first build. It is a second idea and
   it can wait until the core rate card is good.
3. **This tool feeds the proposal tool.** Once both exist, the tiers and figures set here flow
   straight into a proposal. That needs shared state, which the skeleton does not have.

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
