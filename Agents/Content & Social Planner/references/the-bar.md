# The bar for a post, and who sets it

<!-- Moved out of ../CLAUDE.md on 2026-09-17. That file was 403 lines against
     Anthropic's documented target of under 200, and their guidance is explicit that a
     longer file consumes more context and reduces adherence to itself. A sibling file
     here loads only when somebody opens it. See ARCHITECTURE.md section 1.
     Nothing was cut: this is the section as it stood. -->

**Nothing here rests on this tool's taste.** Raj: whoever sets the bar sets it for
everything we write, and it is not our judgement.

**There is no single Cagan for content, and inventing one would be the fabrication
this product exists to avoid.** Product management is one discipline with one
canonical voice. Content splits into three questions and each has a different
best answer, so three people set the bar, one per question.

| The question | Who answers it | The bar |
|---|---|---|
| Is this post worth posting at all? | **Jay Baer, _Youtility_** | Useful enough that someone would pay for it, and useful to a reader who never buys. Help, do not sell |
| Is it written like a person? | **Ann Handley, _Everybody Writes_** | Clear, concrete, in their own voice. Already named in `base-prompt.md` |
| Is the month shaped right for the channel? | **Gary Vaynerchuk, _Jab, Jab, Jab, Right Hook_** | Give repeatedly, then ask once. Written for the platform, never written once and pasted |

**What each one already governs, and what now checks it:** `bar.ts`.

### The order of authority

1. **Measured evidence about this business** beats everything. What they actually
   posted, what they changed about our wording, and what the numbers said.
   `learning.ts` holds it, with its evidence, and a solid learning is never given
   twice.
2. **The three above**, where there is no evidence yet, which is every business on
   day one.
3. **This tool's judgement.** Never. If a rule is not one of the first two, it is
   not a rule, and a check that encodes our taste is worse than no check because
   it is invisible.

**Evidence replaces the default, it does not argue with it.** When the numbers say
something for this business, the number wins and carries its date and its source.
Until then the named bar applies and says whose it is.

### Honest about what is checkable

A rule that cannot be checked mechanically is a rule that holds until somebody is
in a hurry, so each is written as a check or admitted as unchecked:

- **Vaynerchuk's ratio and platform fit are fully checked**, in `MIX` and in the
  per-channel word targets and mediums. They were before anyone named him.
- **Baer is partly checked.** A post can be tested for whether it carries a fact a
  reader could use without buying. It cannot be tested for whether that fact is
  worth paying for.
- **Handley is partly checked.** Sentence length, jargon and the house style are
  mechanical. Whether a sentence sings is not, and no guard should pretend.

The unchecked remainder is the case for `build-notes.md`'s standing instruction to
read a full `most days` plan end to end, by hand.
