# How the analysis is done

> Split out of `CLAUDE.md` on 2026-09-14, when that file passed its cap. This is
> the analytical method, read when building or reviewing the analysis. The hard
> rules that must never break stay in `CLAUDE.md` sections 4 and 5, because those
> are read every time.
>
> Section 2 below was researched against Porter's four corners, published
> battlecard practice and the documented failure modes of competitor analysis,
> rather than decided from taste.

---

## 1. The three actions (decided 2026-09-14)

Four areas are researched: pricing and packaging, marketing and channels, reviews and reputation,
service blind spots. **Three actions do not cover four areas, and they are not meant to.**

| Rule | Why |
|---|---|
| **Three, never more** | A business of one to twenty people will not do six things. Three is what actually gets done |
| **Ranked by impact**, strongest first | An unranked list makes the owner do the prioritising, which is the work we were hired for |
| **Every one is evidence-backed** | Each carries "What this is based on": the numbers it came from, and the source and date. An action with no evidence behind it does not ship |
| **Each says which weakness it attacks** | A small uppercase label above the heading, naming one of the four areas. It makes the coverage visible rather than implied |
| **Coverage is never forced** | Pick the three with the most evidence behind them, wherever they fall. If two come from the same area, so be it. Inventing a fourth-rate action to fill an area is padding, and padding is how the whole list stops being trusted |
| **Say the gap out loud** | The line under the heading tells the owner these are the three with the most evidence, not one per area |

**Where an area genuinely has nothing to say, say nothing.** On the 14 September barber run, service
blind spots was thin for all six because Booksy publishes one headline service per shop. That is a
finding, it is already in the table, and it is not an action.

**A price change is a hypothesis, not an action**, unless we know their costs. It goes in the
evidence under "Worth testing, not doing yet" and points at Pricing and Package Builder. See that
tool's rule: we never recommend a price without knowing what the work costs to deliver.

## 2. What a snapshot cannot say (added 2026-09-14)

Researched against Porter's four corners, battlecard practice and the documented
failure modes of competitor analysis. Five things were missing. All five are
judgement rather than fact, so each carries a harder rule than the facts do.

**1. Read the reviews, do not count them.** We had 4,799 reviews across five
competitors and read the number. Reviews are the only place a business with no
sales team can see why anybody chose. Themes only, never an individual: a theme
may say that customers name their barber and how often, never which names.
A theme needs two mentions, a denominator and a date range. `src/reviews.ts`.

**2. Say when they win, and when they lose.** "We are better" is unusable.
"Someone who already knows they want a beard trim" is usable. A card that claims
you win on everything gets ignored, so the losing case is not optional.

**3. Say what a competitor is likely to do next.** Four corners: what drives
them, what they appear to believe, what they are doing, what they could do, each
from something we read. Every prediction carries a date it can be judged on and
a sentence saying what would prove it wrong. It is never worded as a fact.

**4. Find the substitutes.** The most frequent mistake is looking only at the
same shape of business. On the first real run the tool found two mobile barbers
and filed them as ordinary competitors. They are a different answer to the same
question and you cannot beat them on price. Every competitor carries a shape:
same, substitute, or the job done without paying anyone.

**5. Do not take the owner's word for it.** People rate themselves less biased
than average, and here that becomes a steady over-reading of their own position.
An unchecked self-claim is labelled unchecked and can never be evidence for an
action.

