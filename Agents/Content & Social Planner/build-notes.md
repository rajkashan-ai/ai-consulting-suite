# Build notes for the first version

> Read once, while building. The rules in `CLAUDE.md` are read every time, which
> is why they stay there and this does not.

---

- **Two questions on screen before the run**: cadence and tone. Both are named
  options, never a text box.
- **Channels are detected and shown for confirmation, not typed.**
- **No workspace switcher.** One business, theirs.
- **Export carries the posts, the shot instructions and the gap list, nothing
  else.** No app furniture, no critique labels.
- **Cost scales with the cadence answer.** `most days` is twenty-two posts
  against `once a week`'s four. Log cost per run and check the `most days` case
  does not quietly cost five times what a flat price assumes.
- **The rewrite is one batched call per critique**, never one per post. This is
  the single line item that decides whether the flat price works.

## Before launch

**Check the channel character caps** in `src/types.ts`. They are conservative
floors under each platform's published limit, set so a post cannot be rejected
even if a limit has moved. They are facts about somebody else's product, they
change, and a stale one here would be a claim we could not source. The word
targets next to them are our own editorial choice and need no checking.

**Read a full `most days` plan end to end, by hand.** Twenty-two posts is where
repetition shows, and no guard can tell you that two posts make the same point
in different words. That is `thirty-days-does-not-read-as-one-post` in the eval
set, and it needs a person.

## Where the voice note lives

On the business profile, not in the plan. Every other tool reads it too, which
is the whole reason it is worth building: a correction made here improves the
Proposal Builder's writing without anyone asking it to.
