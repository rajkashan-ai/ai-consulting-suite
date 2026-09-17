# Google reviews: what we can read, what it costs, and the rule that shapes the build

**Researched 2026-09-15**, after a user panel found Google absent from the
Competitor Tracker screen entirely: not in the "Checked" list, not in the "Not
checked" list, nowhere. Every source below was read at Google's own domain.

## Why this matters more than any other channel we have looked at

The tool's loudest number is "0 of 4,799 reviews about you". A Google Business
Profile is **free to create** and **anyone with a Google account can leave a
review** without holding an account on any booking platform
(`support.google.com/business/answer/7039811`, `support.google.com/maps/answer/6230175`,
both read 2026-09-15). So the cheapest route out of the problem the screen
shouts about is the one channel the screen never mentions.

## What the API gives us, and the price

`rating`, `userRatingCount` and `reviews` are billed at the **Place Details
Enterprise SKU**, not Pro. Confirmed at
`developers.google.com/maps/documentation/places/web-service/place-details`.

| SKU | Per 1,000 requests | Free each month |
|---|---|---|
| Essentials | $5.00 | 10,000 |
| Pro | $17.00 | 5,000 |
| **Enterprise** (what we need) | **$20.00** | **1,000** |

Read at `developers.google.com/maps/billing-and-pricing/pricing`, 2026-09-15.

**Cost is not the blocker.** Six businesses (the customer plus five
competitors), once a week, is about 26 calls a month per customer. The free
Enterprise tier covers roughly the first 38 customers, and past that it is
2 cents a call, about £0.40 per customer per month. That is cheaper than the
search visibility we already ship.

## The rule that actually shapes the build

**Places API content must not be cached or stored.** The only exceptions are
the place ID, which may be kept indefinitely, and place coordinates, which may
be kept for 30 days. `rating` and `userRatingCount` have **no** caching
exception: they must be fetched live and displayed with Google attribution.
`developers.google.com/maps/documentation/places/web-service/policies` and
Google Maps Platform Service Specific Terms, both read 2026-09-15.

This collides head-on with how this tool works. Everything else we read is
stored once a week and compared against last week, which is the whole point of
a tracker: "HINCES has gained 40 reviews since Monday" is the product. **We may
not compute that for Google**, because it requires keeping last week's number.

Three consequences, and they are design constraints rather than bugs:

1. **Google numbers are live, not "read on 14 September".** Every other figure
   on the screen carries a read-date. A Google figure cannot, and must not be
   presented as though it were a stored weekly reading.
2. **No week-over-week movement on Google.** The one place where the "what
   changed" mechanic does not reach.
3. **Attribution is mandatory**, and Google content must be visually
   distinguished from other content by a border, background or whitespace, with
   a link through to Google Maps. Our comparison table mixes sources in one
   grid, so this needs a deliberate answer, not a footnote.

## The one route that is not constrained this way

The **Google Business Profile API** is a different product: the owner connects
their own profile and authorises access to their own business. Different terms,
and it covers the customer's own data only, never a competitor's. That is the
right route for "your reviews" and useless for "their reviews".

So the honest shape is a split: the customer's own Google data through the
Business Profile API once they connect it, and competitors' through Places,
live and uncached.

## Open, for Raj

- Whether a live, uncomparable Google number earns its place on a screen whose
  promise is "what changed since last time".
- Whether to ship Google as "Not checked, and here is why" until the above is
  answered, which is honest today and costs one line.
