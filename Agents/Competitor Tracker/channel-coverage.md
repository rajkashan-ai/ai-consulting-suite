# Marketing channels: what we cover, what we do not, and why

> **Why this file exists.** Raj, 14 September 2026: a thorough competitor
> analysis needs a wide breadth view, so we have to check all the top channels.
> This is the honest map. Every "no" below has a reason and a date.
>
> **Checked 2026-09-14.** `robots.txt` results are first-hand. Coverage claims
> about what each library contains are from write-ups, not from the platforms'
> own pages, which block automated reads. Re-check before launch.

---

## 1. Paid advertising

Seven platforms publish an ad library. Five of them exist only because the EU's
Digital Services Act forces them to, **and the DSA does not apply to the UK.**
That single fact decides most of this table.

| Platform | UK ads in the library? | Can we lawfully take them? | Why not |
|---|---|---|---|
| **Meta** (Facebook, Instagram) | Yes | **Almost.** Built and tested | One identity confirmation outstanding. Whether the *API* returns GB commercial ads is still unsettled, and `probeCommercialCoverage` answers it in one call |
| **TikTok** | **Yes.** Their Commercial Content Library covers 33 regions: the EEA, the UK, Switzerland and Türkiye | **No** | Two doors, both shut. `library.tiktok.com/robots.txt` disallows `/api`, `/ads` and then the whole site. The official Commercial Content API is gated to academics and non-profits, and commercial users are explicitly ineligible |
| **Google** (Search, Display, YouTube) | Yes, in the web tool | **No** | `adstransparency.google.com` has no `robots.txt` and no API. The page ships 2.5MB of JavaScript and 159 characters of text, so there is nothing to read without executing their app |
| **LinkedIn** | Yes, worldwide | **No** | Checked again 14 Sep, harder. Their `robots.txt` names about twenty search-engine crawlers and then ends `User-agent: *` / `Disallow: /`. The ad library itself returns **403** to us. One door only: `whitelist-crawl@linkedin.com`. This is a blanket block on everyone, not a B2B question |
| **Snapchat** | EU only | No | Commercial tier is EU, and it is CSV downloads by hand |
| **Pinterest** | EU only | No | EU only, web UI, no API |
| **X** | EU only | No | EU only, bulk files, described as hard to query and incomplete |

**What none of them publish, for anybody.** Spend, clicks, engagement, and
impressions as anything better than a bucketed range, outside the political
tiers. So "how much are they spending" has no lawful answer at any price we
would pay, and the tool must never imply one.

**The practical read.** Meta is the one that matters and the one we can get. For
a barber, a plumber or a clinic, Facebook and Instagram are where the local ad
money goes. TikTok would be the second prize and is closed to us. Google is the
real loss, because search ads are where intent lives, and nothing legal gets
them.

---

## 2. Organic and owned

This is where the bigger gaps are, and none of them is blocked by anyone.

| Channel | Status | Note |
|---|---|---|
| Their own website | **Covered** | Prices, services, claims |
| Booksy, Fresha | **Covered** | Prices and review counts, the richest single source for anyone who takes bookings |
| Which platforms they are on | **Covered** | Presence only |
| Follower counts | **Covered for them, not for us** | We count competitors and not the customer, which is why no action can be built on a follower comparison |
| **Who comes up when a customer searches** | **Built 14 Sep** | Counts, never a position. See section 2 |
| **Whether they are still active** | **Built 14 Sep** | Last review date from their booking page. Better than a post date: a review means somebody paid |
| Google Business Profile depth | **Not built** | Photos, posts, hours, attributes, Q&A. Places API, paid per call, already on the source list |
| Directories: Yell, Bark, Rated People, MyBuilder | **Not built** | Free, and trade-specific |
| YouTube, TikTok, LinkedIn presence | **Not built** | Presence is visible from their own site's links |
| Email marketing | **Invisible** | Nothing public. Signing up to a competitor's list is not something we will do |
| Offline: leaflets, van livery, local press, sponsorship | **Invisible** | Real spend, no public record |

### The two gaps worth more than every ad library, and only one survived

**Who comes up when someone searches.** For a local business this is *the*
marketing question. A barber does not care what HINCES pays Meta; they care that
HINCES comes up first for "barber Shrewsbury" and they do not come up at all.

Licensed search is on the source list at **$10 per 1,000 searches**, confirmed
from Anthropic's own documentation on 14 September, and nothing legal or
technical is in the way.

**One thing had to be solved first, and now is.** A server-side search has no
location, so "barber Shrewsbury" came back with Shrewsbury *Pennsylvania* and
Shrewsbury *Massachusetts* ahead of the real one. The web search tool takes a
`user_location` object, `{type: "approximate", city, region, country, timezone}`,
and the business's town is already in their profile. That fixes it.

**Never call the result a Google ranking.** What comes back is who appears for a
search, not a numbered position on a results page. "You do not come up for this
and these five do" is true and useful. "You are ninth on Google" is the same
class of invention as a traffic figure, and the same test should catch it.

**Cost, corrected.** Five searches a week is $0.05, so about **17p per customer
per month**, plus the tokens for reading the results. An earlier note in this
file said 5p, which was out by three or four times. Small either way, and worth
being right before it goes into a pricing model.

**Whether a competitor is still trying.** Answered, by a route this file first
said was closed.

**The claim here was that this is blocked. It is not, and the error was in how
the question was written.** "We cannot read Instagram post dates" is true.
"We cannot tell whether they are still active" does not follow from it, and that
is what reached the screen.

Booksy venue pages carry `schema.org` Review markup with `datePublished`, they
are allowed by robots, and we already read them for prices. On 14 September:
HINCES last reviewed 4 days ago, The Fade Inn 3, NO.1 Barbers 7. A dated review
beats a dated post, because a review means somebody paid and walked in.

Still true: Instagram's `robots.txt` prohibits automated collection and names
`ClaudeBot` with `Disallow: /`, a logged-out profile returns nine characters of
text, and Facebook returns 400. Those doors are shut. They were just not the only
doors.

**The rule to carry:** write every uncheck as the question, not the method, then
look for any route to it.

## 3. What to tell a customer

Never say "nobody is advertising". Say we cannot see it, and which of the two
things that means: either we looked and found nothing, or we cannot look at all.
The difference matters to them and the rule is in `_shared/base-prompt.md`.

---

## 4. Order of work, when someone asks

1. ~~Search visibility.~~ **Built 14 September.** It found a flaw in how we pick competitors on
   its first run, which is in the root `memory.md` as open question 7.
2. **Meta ads.** Built. Waiting on the identity confirmation in `ad-library-access.md`.
3. **Google Business Profile depth.** Costs per call, so it needs the price settled first.
4. **LinkedIn.** Blocked for everybody, not just us. The only route is asking
   `whitelist-crawl@linkedin.com` for permission. Worth an email whenever we take on a customer
   whose buyers are actually on LinkedIn; pointless for a barber.

**Knowing a competitor is on a channel is a different question from reading it.** Their own website
usually links to every profile they have, so presence is free and lawful even where the platform
itself is shut to us. That is the line the two lists on screen draw.

**Last-post date came off this list on 14 September**, once checking showed it was
blocked rather than free.
