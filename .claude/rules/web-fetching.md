---
paths:
  - "web/lib/research/**"
  - "web/tools/**/stages.ts"
  - "web/tools/sources/**"
  - "web/app/api/**"
---

<!-- Moved out of CLAUDE.md on 2026-09-17. It was 63 lines of a 351 line file
     that loads in every session, and two of six tools ever touch the web.
     Anthropic's guidance is to target under 200 lines and to use path-scoped
     rules rather than imports, which still load at launch. See
     ARCHITECTURE.md section 1. -->

# Getting data off the web, legally

Only Competitor Tracker and Funnel Builder touch the web. Same rules for both.

**Where facts may come from**

| Source | Cost | Notes |
|---|---|---|
| The competitor's own public pages | Free | Logged out only. Pricing, services, case studies |
| **Booksy** venue pages | Free | For anyone who takes bookings, the richest single source there is: every price and review count on one page. `robots.txt` **disallows `/search/`**, so we never crawl their search |
| **Fresha** venue pages | Free | Same shape. `/search*` disallowed, venue pages allowed, salons sitemap published |
| Claude API web search tool | $10 per 1,000 searches | Anthropic runs it. Domain allow and block lists |
| Claude API web fetch tool | Tokens only | Only fetches URLs already in the conversation |
| Companies House API (UK) | Free | Filed accounts and officers. Official open data |
| Meta Ad Library API | Free | Every ad a rival is running now, word for word, with its start date. The only source that says what a competitor pays to say rather than where they show up. Needs an identity confirmation at `facebook.com/ID`, 2 to 7 days, and nothing else. **Whether GB returns commercial ads is unsettled and decides the feature.** Steps and the probe that settles it: `Agents/Competitor Tracker/ad-library-access.md` |
| Google Ads Transparency Center | Free | Thinner, no mature API |
| Google Places API | Paid per call | Reviews shown live with attribution, never stored. Place IDs may be kept, coordinates 30 days |
| Trustpilot API | Paid | Their API only. Scraping Trustpilot is banned in their terms and actively blocked |
| Similarweb or Semrush | $125 to $549 a month | Not used. The only lawful source of a rival's traffic mix, and we chose not to buy it |
| Checkatrade | | **Not used.** Returns 403 to us |
| TikTok Commercial Content Library | Free | **Not used.** Covers the UK, and both doors are shut: `library.tiktok.com/robots.txt` disallows `/api`, `/ads` and the whole site, and the official API is gated to academics and non-profits |
| LinkedIn Ad Library | Free | **Not used.** Their `robots.txt` prohibits automated access without written permission. Ask at `whitelist-crawl@linkedin.com` if we ever take on B2B customers |
| Google Ads Transparency Centre | Free | **Not used.** No API and no `robots.txt`. The page is 2.5MB of JavaScript and 159 characters of text, so there is nothing to read |
| Snapchat, Pinterest, X ad libraries | Free | **Not used.** Commercial tiers are EU only, and the UK is out of scope since Brexit |

**Booking platforms are the first place to look, and their search is out of bounds.** Both Booksy
and Fresha let us read a named venue's page and neither lets us crawl their search results
(`robots.txt`, checked 14 September 2026). So the platform never tells us *who* the competitors are.
Finding them is Claude web search or Google Places; the platform is then read one venue page at a
time. **Before launch, read both sets of terms of use.** `robots.txt` being clear is not the same as
the terms allowing it, and Trustpilot is the precedent: a site can permit the crawl and ban the use.

**How the crawler behaves**

1. `robots.txt` is the gate. Disallowed means we do not fetch it.
2. Logged out only. Never a login, a paywall, a captcha, or an IP rotated to dodge a block.
3. Identify ourselves in the user agent, with a URL explaining who we are.
4. One request at a time per site, with a pause between. We are not a load test.
5. Read and summarise. Never store or reproduce substantial copied text: copyright applies, and the
   UK kept the database right after Brexit.
6. Reviews give themes, never named individuals. Under UK GDPR "it was public" is not a lawful basis.
7. Every stored fact carries its URL and the date it was fetched.
8. Honour any takedown request the same day, and keep a way to block a domain permanently.

**No traffic data (decided 2026-09-14, corrected 2026-09-16).** This said a competitor's traffic
mix "cannot be obtained lawfully", which is false: it can, by buying a Similarweb or Semrush
licence, and plenty of people do. What is true is that **we have not bought one, and an estimate
from anyone is still an estimate.** So the product does not offer it, nothing may estimate, infer or
imply it, and if a customer asks we say we do not have that data. That is a choice about cost and
honesty, not a law, and the screen already words it correctly.

Corrected under 1.4.10: the original sentence was a limit nobody had tested, and it would have
stopped us even considering a licence if the product ever needed one.

**Cost of one competitor run, measured 2026-09-16.** About $1.10 to $1.25. The last clean run was
179,000 input and 15,000 output tokens plus five web searches: roughly $1.07 of it is the writing
stage on Opus, $0.10 the searching and listing work on Sonnet, $0.05 the searches themselves.

Input roughly doubled when the grid split into four parallel calls, which halved the time. Prompt
caching on the shared evidence would buy most of that back and has not been done.

The old estimate here was $0.50 to $2.00 "until measured". It is measured.
