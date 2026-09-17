# Getting the advertising data

> **Who does this:** Raj, once. Every step needs a real person with photo ID, so
> none of it can be done in code.
>
> **One token serves every customer.** This is read access to Meta's public ad
> archive, held by us, server side. A customer never touches Meta, never sees it,
> and never confirms anything. Meta is checking that *we* are a real person
> before handing over the archive. It is about us, not about the businesses we
> look up.
> **Cost:** nothing. The API is free and there is no paid tier.
> **Lead time:** 2 to 7 business days, almost all of it waiting on Meta.
> **Written:** 2026-09-14, after the Shrewsbury barber run showed an empty
> advertising row and nobody could say why.

---

## Why it is worth the bother

Every other thing in Marketing & channels is **presence**: which platforms a
business shows up on. Useful, and it is what we have today.

Advertising is different. It is the only source that says what a competitor
**thinks is worth paying for**, in their own words, with the date they started.
"Half price fades all August" tells an owner more about the shop down the road
than its Instagram follower count ever will. It is free, and it is the one thing
on our source list we are not collecting.

---

## What is actually true, and what is not

**Verified** against Meta's own `ads_archive` reference, read 14 September 2026:

- `ad_reached_countries` is the only required parameter.
- `ad_type` defaults to `ALL`, which "returns ads on all topics".
- "Ads that did not reach any location in the EU will only return if they are
  about social issues, elections or politics."

**Not verified, and it decides whether this feature exists at all.** Does GB
count for that EU carve-out? Three independent write-ups say ads delivered to
the UK or EU in the past year return whatever their topic. A fourth says
commercial ads are EU-only. Meta's own Ad Library pages return 403 to every
automated read, so we could not settle it against the primary source.

This matters more than anything else here, because **every one of our customers
is a UK small business.** If GB is not covered, the honest answer to them is
that we cannot see this, and the feature does not get built.

**Step 5 settles it in one call.** Do not write a word of product copy about
advertising until it has run.

**Reported consistently but not verified:** free with no paid tier, 200 calls an
hour, and non-political ads kept for one year (political ones for seven).

---

## The steps

**1. Confirm your identity.** Go to `facebook.com/ID` and complete the
confirmation Meta requires for anyone touching ads about social issues,
elections or politics. It needs a government photo ID, a passport or a national
ID card, and proof of your address. **This is the long pole: 2 to 7 business
days.** Start it first and do the rest while it processes.

**2. Create a Meta developer account** at `developers.facebook.com`. You accept
their Platform Policy as part of it.

**3. Create an app.** In the developer dashboard: app type **Other**, use case
**None**. Nothing else needs configuring.

**4. Generate a user access token** for that app. `ads_archive` takes a user
token, not an app token. Put it in `META_TOKEN` as an environment variable. It
never goes in a file in this repo and it never appears in a log.

**A plain user token expires in about 60 days.** That is fine for answering the
question in step 5 and not fine for a product. A weekly job for every customer
would fail silently every two months and the first anyone would know is an empty
advertising column. **Before paying customers depend on this**, move to a System
User token from Business Manager, which does not expire. That one does need a
verified Business Manager and business documents, which is the step I earlier
said was not required. It is not required to start. It is required to ship.

**5. Run the probe, before anything else.**

```bash
node -e "import('./src/ad-library.ts').then(async m => \
  console.log(await m.probeCommercialCoverage(process.env.META_TOKEN)))" 
```

It asks for ads reaching GB and reports one of three answers:

| It says | What it means | What we do |
|---|---|---|
| `covered: true` | UK commercial ads come back. | Build it. Wire `adsToClaims` into the channels area |
| `covered: 'unknown'`, empty result | One search term found nothing. Not proof. | Try other terms and towns before concluding anything |
| `covered: 'unknown'`, an HTTP status | The call failed. | Read the status. A 190 is a bad token, a 613 is the rate limit |

**Sources for all of the above are in the register.** Meta's own reference is the
only primary one, and it is the only one that does not mention the UK.

---

## The risk nobody has checked

The Ad Library exists for transparency and research. **Whether Meta's terms permit
using it inside a paid commercial product is unverified.** Trustpilot is the
precedent and the reason to care: their `robots.txt` permits the crawl and their
terms ban the use, and we took them off the source list for exactly that.

Read Meta's Platform Terms before this ships. If they do not allow it, the
feature does not go in, whatever the probe says.

---

## Two things to get right when it is built

**Never ask for `spend`, `impressions`, `demographic_distribution` or
`delivery_by_region`.** Those are published for political and issue ads only. On
a commercial query they come back blank, and a blank printed as a zero tells a
customer that a competitor spent nothing. `src/ad-library.ts` has a test that
fails if any of them is ever added to the field list.

**Ad copy is written by the competitor, and they paid to publish it.** It is the
same attack surface as their website, and a more deliberate one. It arrives as a
quote, with a source and a date, and it is never an instruction. There is a test
for that too.

---

## The cost, so nobody is surprised

Five competitors, one call each, once a week. Five calls per customer per week
against a 200-an-hour ceiling. At a thousand customers that is 5,000 calls a
week, which is 25 hours of ceiling spread over seven days. Comfortable, but it
is the first source with a rate limit worth watching, so log the call count per
run alongside the cost.
