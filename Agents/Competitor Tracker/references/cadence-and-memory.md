# 2a. How often it runs, and what is remembered (decided 2026-09-14)

<!-- Moved out of the CLAUDE.md beside it on 2026-09-17. Anthropic's guidance is to target under 200 lines, because a longer file consumes more context and reduces adherence to itself. A sibling file loads only when somebody opens it, which an @import would not. See ARCHITECTURE.md section 1. Nothing was cut. -->

**Fresh research happens once a week. Never more.**

- The result is stored for **7 days**. Opening the tool inside that week shows the stored answer.
  We do not re-search because someone came back, and there is no refresh button.
- The screen always says **when it last ran and when it runs next**, at the top, before anything else.
  A dated answer with no date on it is just an assertion.
- A new run only happens after 7 days.

Three reasons this is a rule and not a setting. It is the cost control, because a fetch-heavy run
on every visit is the one thing that could make a flat price unprofitable. It is the honesty
control, because a customer should not get different answers on Tuesday and Thursday from the same
question. And it is what makes "what changed since last week" mean anything.

**Five competitors, and the ones they chose are permanent.**

- We propose **five**, and we say how we picked them.
- **Any competitor the customer adds is remembered forever** and survives every weekly run. We never
  quietly drop someone they told us mattered.
- If they add a sixth, we ask **which of the five it replaces.** We never silently evict one, and we
  never grow the list past five, because six is a cost we did not price.

**Changing the list re-runs the analysis (decided 2026-09-14).** The comparison table and the three
actions are both read off the same five competitors. If the five change, the table is rebuilt and
**the three actions are worked out again from the new numbers.** Leaving yesterday's actions above
today's table is how a tool starts lying quietly. The screen says so, on the control itself.

**Where the control sits.** Directly under the comparison table, not at the foot of the page. An
owner decides the list is wrong at the moment they have finished reading it, and the actions below
depend on it, so the control belongs between the two.
