# Image sizes, and when they were checked

> **Perishable.** Every number here is a fact about someone else's product and
> they move it. Checked 2026-09-15. **Re-check before launch and every quarter.**
> One file, so a size is changed once and not hunted through the code.

| Format | Pixels | Ratio | Used for |
|---|---|---|---|
| Square feed | 1080 × 1080 | 1:1 | Instagram and Facebook feed |
| Vertical feed | 1080 × 1350 | 4:5 | Instagram and Facebook feed, takes more screen |
| Full screen | 1080 × 1920 | 9:16 | Instagram Story, Instagram Reel, Facebook Story, TikTok |
| Link preview | 1200 × 630 | 1.91:1 | Facebook and LinkedIn shared links |
| LinkedIn feed | 1200 × 1200 | 1:1 | LinkedIn image post |
| Amazon square | 1200 × 1200 | 1:1 | Amazon ad, the square placement |
| Amazon tall | 900 × 1600 | 9:16 | Amazon ad, the tall placement |
| Amazon wide | 1200 × 628 | 1.91:1 | Amazon ad, the wide placement |

## Where the Amazon numbers came from

Amazon's own ad-specs page, `advertising.amazon.com/resources/ad-specs/ecommerce`,
read 2026-09-15. It calls these the responsive sizing images and asks for all
three so one creative can fill any placement. Minimum quality 600 × 600, maximum
file size 5 MB, which our output is nowhere near.

**These are ad creatives, not the product photo on a listing.** A listing image
has its own rules about background and how much of the frame the product fills,
and this tool does not meet them: it crops and scales, it cannot put a subject on
a white background. Say that rather than let someone upload a cropped shopfront
as a product image.

**Amazon square is 1200 × 1200, which is the LinkedIn feed exactly**, and Amazon
wide at 1200 × 628 is two pixels shorter than the link preview. Both are kept at
Amazon's published numbers rather than folded into the LinkedIn ones, because a
size that is nearly right is the kind of thing a validator rejects and nobody can
debug. The screen says when a selection produces identical files.

## Reel and Story are the same size

Both are 1080 × 1920. **What differs is the safe zone**, not the canvas: a Reel
puts the caption, audio line and buttons over the bottom and right, a Story puts
the profile at the top and the reply bar at the bottom.

So ticking both produces two identical files, and the tool says so rather than
exporting the same image twice under two names. **The version worth building
later** shifts the subject up so it clears the Reel interface, which is a smart
crop rather than a resize and needs the safe-zone numbers verified first.

## Sources

- Hootsuite, social media image sizes, September 2026: https://blog.hootsuite.com/social-media-image-sizes-guide/
- Buffer, social media image sizes: https://buffer.com/resources/social-media-image-sizes/

Both are secondary. **Before launch, check each number against the platform's own
published guidance**, the way the Competitor Tracker checks a price against the
page it is on rather than against a write-up about the page.
