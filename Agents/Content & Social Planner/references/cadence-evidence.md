# What the cadence recommendation may rest on

<!-- Moved out of ../CLAUDE.md on 2026-09-17. That file was 403 lines against
     Anthropic's documented target of under 200, and their guidance is explicit that a
     longer file consumes more context and reduces adherence to itself. A sibling file
     here loads only when somebody opens it. See ARCHITECTURE.md section 1.
     Nothing was cut: this is the section as it stood. -->

**Say the number, then what it costs.** "Two a week. That is 9 posts and 9 photographs between now
and 13 October, across Instagram and Facebook." Every reason is a fact we hold: our own arithmetic,
their answer about their time, which channels are quiet, and from month two the only measured
evidence in the feature, how much of last month they actually posted.

**We can read it and we may not. Corrected twice, 2026-09-16 and again 2026-09-17.**

The original text said "we cannot count what they post now". I corrected that to "we can", having
checked that a public Instagram profile loads without signing in and that every post's creation
date is encoded in its own shortcode. Measured on a real Hertfordshire bakery: last posted one day
ago, 6 posts in 30 days, 2.4 days between them.

That correction was right about the technology and wrong about the decision, which is worse, because
it reads as permission. Instagram's robots.txt is:

    User-agent: *
    Disallow: /

Every agent, every path. `CLAUDE.md` 1.5 rule 1 says robots is the gate and a block is never worked
around, so reading it is out, whatever a shortcode encodes. "Cannot" was false and "may not" is
true, and I fixed the wrong half.

**So this tool does not count what they post.** The code never did: `detectChannels` reads platform
names off the business's own website and fetches nothing from any platform. That is the position to
keep.

**What that costs, said plainly.** The cadence recommendation is a judgement against their answer
about their own time, not a comparison against a measured rate. "Step up" and "step down" mean less
than they would with a number behind them. That is the honest trade and the alternative is breaking
a rule with legal weight.

**If this is ever wanted properly**, the route is the owner telling us, or Instagram's own Graph API
with their consent, which is what it is for. Not a fetch we are asked not to make.

**What is still true:** there is no industry benchmark worth quoting, and counts can be inflated by
someone who wants to. So we say what we counted and when we counted it, the same as every other
claim in the suite, and we never compare them to an invented average.

**And it is still theirs to confirm.** Read it, show it back, let them correct it. What is allowed,
and the step-down case: `recommendation.md`.

Method: the profile is public, `lib/research/fetch.ts` rules apply, and nothing signs in to
anything. Decoding a shortcode is base64 over `A-Za-z0-9-_` to a media id, then
`(id >> 23) + 1314220021721` milliseconds.

**The step up is cost and coverage, never results.** "Three a week would let your beard work have
its own thread instead of one post a month" is ours to say. "Three a week will get you more
enquiries" is not, in any phrasing. `findPromisedResults` refuses it.
