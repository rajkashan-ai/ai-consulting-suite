# Design rules

> Split out of `CLAUDE.md` on 2026-09-14, when that file passed its cap. The
> stylesheet itself is `app.css` and it is the record; this is the reasoning
> that is not obvious from reading CSS.

---

## 6b. The type and spacing system (decided 2026-09-14)

**`app.css` is the stylesheet and the record.** It is heavily commented and every
number in it is credited to the production CSS it was measured from. Read it
rather than a copy of it here.

Both pages carry it. Published artifacts cannot link a stylesheet, so
`python3 sync-styles.py` inlines it between markers and `--check` fails if a page
is stale. **Never hand-edit the CSS inside an HTML file.**

**Why it exists.** On 14 September the landing page and the workspace had drifted
to 19 font sizes and 21 tracking values between them, including `-.010em` and
`-.01em` as two rules for the same number. Neither file was wrong alone. Nothing
had ever compared them.

The six rules that do the work:

1. **Eight sizes, three weights, tracking keyed to size and never to component.**
   Apple's whole homepage runs on 11 sizes and 3 weights.
2. **Headings are styled by class, never by tag.** Semantic level is an
   accessibility decision, visual role is a design one. Tie them together and one
   of the two has to be wrong. Nine `h3` rules were fighting at equal specificity
   and being settled by source order.
3. **Spacing is a strict 4px step**, `margin-top` only, and the gap above a
   heading is at least 4x the gap below it.
4. **Two grounds, alternating, no rule between them.** Three cannot alternate,
   because a shade change then stops meaning "new section".
5. **One class name, one job.** A chip called `.why` collided with a paragraph
   called `.why` and set the three most important sentences on a page in
   uppercase bold.
6. **Marketing headings are their own ladder** (`.t-display*`), fluid, and never
   used inside the workspace. So is the product-shot miniature at 8 to 11px,
   which is fenced in the landing page's own CSS: it is a picture of a screen
   drawn small, not text anybody reads.

## 6c. Spacing, and how much there is to read (decided 2026-09-14)

**One place owns the vertical rhythm.** It used to live in `.band__in > * + *`
and on each component, so `.tablewrap`, `.pair`, `.tabs` and `.addbar` each set
their own top margin and the same relationship rendered at 16, 32 and 64px in
one view. Worse, a heading sat as far from its own body as from the block above
it, so nothing looked like it belonged to anything.

Every gap is now the default 32px or a named exception with a reason: a heading
owns its body (16), a table owns its note (12), a card header sits on its list
(0), the feedback block is pushed away (64). **A component never sets its own
top margin**, or it cannot be moved without changing the spacing around it.

**A sub-heading earns its place only if it says something the heading cannot.**
A scope, a count, a caveat. "What we looked at" followed by "everything we read
this week and everything we did not" is the heading again, longer. Most sections
do not need one.

**The page explains itself as much as it informs, and that is a bug.** The
sub-lines under every claim existed to prove the tool was being honest, which was
right for a mockup under review and wrong for something an owner opens on a
Monday. **The honesty belongs in the claim, not in commentary about the claim.**
447 words came out on 14 September and nothing of value went with them.

**What was cut, and why it is the pattern to repeat.** A table that another
section now supersedes. A column that said "we cannot see this yet" six times
where one line under the table does it. Sub-lines restating the claim above
them. Numbers listed in full where the total was the point.



## The section gap, and the mistake that doubled it

**96px is the gap BETWEEN two sections, not the padding on each of them.** Set
as padding it applies top and bottom, so every join between adjacent bands came
out at **192px**, and a heading sat 96px below the start of its own section.

Each band now contributes half. Two adjacent bands still add up to 96, and a
heading sits 48px from the top of its own section. The 8pt grid keeps every step
a multiple of 8, and the internal-before-external rule still holds: 48px between
sections against 24px inside a card.

| | Desktop | ≤1024px | ≤767px |
|---|---|---|---|
| Band padding, each side | 48 | 40 | 32 |
| **Between two sections** | **96** | **80** | **64** |
| First band, top | 32 | 24 | 24 |
| Last band, bottom | 80 | 64 | 48 |

**Every flow container resets its first child.** A heading wrapped in `.actions`
kept its 64px top margin on top of the band's padding and sat 112px below the
start of its own section. The reset covers `.band__in`, `.tabpanel`, `.actions`,
`.posts`, and one level of plain wrapper. **Add a container to that list when you
add one**, or the 64px reappears wherever it is used.

## A line under a table has to earn its place

Only write one if it says something the table cannot: a constraint, a dependency,
a number the reader would otherwise have to work out, or a reason they cannot act
on it yet. Otherwise cut it.

Cut on 14 September: *"You are the only one of the six publishing a full menu,
and the second cheapest classic cut."* The table shows all six prices, so the
reader can see both. It was the table read aloud.

**The same rule for all six tools is in `Agents/_shared/base-prompt.md`**, since
it governs what the tools write and not only what the workspace displays.

### If it is a count, it goes in the table

A paragraph that says "you come up in 2 of 3, and of your five only NO.1 comes
up at all" is a column read aloud. **Counts belong in a totals row**, where they
line up with the rows they summarise and can be scanned instead of parsed.

Applied 15 September to the search table. The paragraph under it went from 51
words to 17, and the 17 that stayed are the only part the table cannot show:
*"You are found when someone wants a beard trim, and invisible when someone is
choosing a barber."* A pattern across rows is worth writing. A sum of them is not.

A totals row is separated by **weight and a rule, never by colour**. The status
colours mean ahead and behind, and a total is neither.

### And a caveat belongs in the cell it is about

The note under the channels table carried a warning that one Instagram follower
count might belong to a different shop. The cell already said "Not confirmed"
with the reason. **A caveat repeated under the table is a caveat nobody reads
twice**, and it separates the warning from the number it warns about.


## The one dark band

Two grounds alternate to say "new section". A third would stop that meaning
anything, so the dark band is not a third ground: it says **"this is the part
you came for"**, and a screen gets at most one.

The device is Bonsai's, and it was already on the landing page as `.who-by`:
they break a page of white sections with solid black ones. Navy is our black.
It is now `.band--dark` in `app.css` so the whole suite has it, rather than one
page having it under its own name. **`.who-by` on the landing page is the same
thing and should converge on `.band--dark`.**

On the Competitor Tracker it goes to the three actions, because they are what
the reader came for. The tables argue for them; the actions are the answer.

**A card on a dark band is still a white card.** Without an explicit reset the
band's colour inherits through and every word inside a card renders white on
white — and a contrast check on the band alone will never catch it, because the
band passes at 14.30:1 while the card is invisible.

**Headings need their own reset, not inheritance.** They are coloured by a rule
that targets them directly, so inheriting `--ink` from the card cannot override
it. The card heading stayed white on white until a rule named it.

Checked after the change: 69 text elements on the dark band, **zero below 4.5:1**.


## Order is the only reason the rhythm works

Every rule that overrides the flow gap is one class, so it ties with the flow
rule on specificity and **wins only by sitting later in the file**. Two rules
were written further up in the type block and lost silently:

- **A second heading inside a band came out at 32px**, no more separated than
  two paragraphs, so a new section started without announcing itself.
- **An intro line sat 32px from the thing it introduces**, the same as an
  unrelated block, so a lead-in floated away from its own table or card.

Both were already in the spec. Neither worked, and nothing reported it, because
a rule that loses on source order fails without an error.

The order, top to bottom, and it must stay this way:

| | |
|---|---|
| 1 | The flow gap: `.band__in > * + *` and friends, **32px** |
| 2 | A line that introduces something belongs to it, **16px** |
| 3 | A heading needs air above it, **64px** section, **48px** sub |
| 4 | A heading owns its body, **16px**; a table owns its note, **12px** |
| 5 | First child of any flow container, **0** |

**A lead-in belongs to what it introduces**, the same way a heading belongs to
its body. `.t-doc` or `.t-doc-sm` immediately followed by a panel, card, table,
pair, post list or action list gets 16px, not the block gap.

Measured after the change, across all three views: heading to its body 16, body
to its surface 16, table to its note 12, block to block 32, new section heading
64, between bands 96. Nothing else.


## Loud, quiet, and the difference between them

A white card with a border is the **primary** surface. A `--card-2` panel with
no border is the **secondary** one. Use the second for anything the reader can
skip: it is there if they want it, and it does not compete.

The suggested competitors were on `.panel--accent` — a white card with a 3px
`--info` rail — and read exactly as loud as the comparison table above them.
They are **alternatives to that table, not an alert about it**, and `--info`
means informational, not important. Now a plain quiet panel, with the heading at
`.t-card` (15px) rather than `.t-sub` (17px).

**A chip is a shape, so its fill must differ from whatever it sits on.**
`.tag--na` is `--card-2`, and on a quiet panel that is the panel's own colour:
the chip vanished and left uppercase grey text with padding doing nothing. On a
quiet ground a chip now takes the opposite surface. Checked after: no chip on
the tracker shares its background with its container.

**Borrowing a status colour for emphasis is the tell.** If a block needs to look
important and the only way found is `--info`, `--good` or `--warn`, the block is
in the wrong place in the hierarchy. Move it, or make it quieter, or give it the
one dark band. Those four colours mean what they mean.


## Where an explanation goes

**With the thing it explains, before it is used.** The add bar at the foot of
the Competitor Tracker carried the sentence explaining how the five competitors
were chosen. By the time a reader reaches it they have already read the whole
comparison, so it answered a question they stopped asking three sections ago.

It is now a section heading above the tabs: **"The five, side by side"** with one
line, *"Picked by how many people have reviewed them. Change them at the foot of
this page."* The add bar says **"Add or change a competitor"** and nothing else.

## Every control carries its class

A sweep on 15 September found **zero form controls with a class**. Every text
input, select and checkbox on the tracker was a browser default, so the whole
`.field` and `.check` layer matched nothing: no 44px height, no `--muted` border
at 6:1, no radius, and the add-bar input could not flex because the rule that
makes it flex was never reached.

**A stylesheet rule that matches nothing fails silently**, and it looks like a
design decision rather than a bug. When a component is specified, check what it
actually matches in the markup, not only that the CSS exists. The same mistake
put every tick and cross above its text a week earlier, for the same reason.


## A label has to describe the state it is in

The competitor list is capped at five. With five on it, **the only thing anyone
can do is change one**, so the control says *"Change a competitor"* and the
button says *"Swap in"*. Below five it is *"Add a competitor"* and *"Add"*.

Offering "add" against a full list promises something the next screen
immediately takes back: you press Add and are asked which of the five to remove.
The button has to name what pressing it actually does.

## Say it once, and say it where it is used

*"Also coming up in searches"* carried a sentence explaining that the five were
picked by review numbers, so these four had not made the list. That explanation
had moved into the section heading above the tables an hour earlier, so the page
was saying it twice in two sizes.

Now the heading carries the only fact that was doing work:
**"Also coming up in searches (none on Booksy)"**, and the sentence is gone.
A parenthesis is often the right length for a qualifier.


## Flat is a scale problem, not a shadow problem

The workspace read flat beside the landing page. The obvious fix was shadows.
**The research says the opposite.** Linear's design system, updated March 2026,
ships three border tokens and **zero shadow tokens**, and Vercel, Stripe and
Anthropic all moved from soft shadows to hairline borders over 2025 and 2026.
A shadow is for something that genuinely floats: a menu, a dialog, a tooltip.
Adding one to a static card would have been going backwards.

**What was actually wrong, measured:** every number on the Competitor Tracker
rendered at 15px. Sixteen figures, all the same size as body text. And 11 of the
page's 14 blocks were exactly 1056px wide, so it was a single column of
identical bands for three thousand pixels.

Two changes, both from what the research supports rather than taste:

**Headline figures.** Three tiles above the fold at 28px, nearly twice body size,
in an asymmetric 2:1:1 grid. The first figure is the one the whole page argues
about, so it takes twice the width. Colour marks the problem and the strength,
one each, never all three.

**The most important thing gets the largest box.** The three actions were ranked
1, 2, 3 and rendered at identical size, so the ranking lived only in a number
nobody had to notice. The first now spans the row and the other two share it.
Modular layouts of this shape are read measurably faster than a stack of equal
blocks, and the size does the same job as the rank.

**Do not reach for decoration when the hierarchy is missing.** If every figure on
a screen is body size and every block is the same width, no amount of shadow,
gradient or border radius will fix it. Vary what matters.


## Prose is primary, and the stylesheet says so

Measured 15 September: the tracker's 1,096 words were split in **near-equal
thirds** across `--ink`, `--ink-soft` and `--muted`. Contrast was never the
problem, every level passed AA and `--ink` is above AAA. **Three levels each
carrying a third is not a hierarchy, it is texture**, and nothing anchors the eye.

The roles, from current guidance: **primary carries all body copy, headings and
labels; secondary carries metadata, captions and helper text only.** Body copy
had drifted a shade down into secondary in both pages, and in two different ways.

- **Workspace:** every mid-grey word was inside the dark band's cards, from a
  reset written the day before that sent card prose to `--ink-soft`.
- **Landing page:** eight prose rules set it directly — `.hero-intro`, `.lead`,
  `.sub`, `.vlist li`, `.three li`, `.incl div`, `.hero-para`, `.body-t`.

`.t-lead`, `.t-doc` and `.t-doc-sm` now state `color:var(--ink)` in `app.css`,
so a component never has to decide, and any tool built later inherits it.

| | Before | After |
|---|---|---|
| Competitor Tracker | 35 / 29 / 30 | **64 / 30 / 0** |
| Content Planner | — | **83 / 13 / 0** |
| Landing page | — | **47 / 23 / 6** |

**`--ink-soft` now carries no body copy anywhere.** It survives as `.t-soft`, for
prose that genuinely has to sit back; as a hover border; and in two places that
are not product, the mockup strip and the product-shot miniature. If you reach
for it, say why.

**Nav labels went to `--muted`** in both pages, because navigation is secondary
chrome and it already has an active state doing the hierarchy work.

**The brand navy was not darkened.** It sits at lightness 18% against a
recommended primary band of 10 to 16, so there is a small case for it, but
`--ink` is the brand colour extracted from the HIL deck. Changing it is a brand
decision with a knock-on to `brand.css`, both pages and the deck, not a design
tweak. Left alone deliberately.


## The measure belongs to text, never to a container

`.panel` and `.fb` capped themselves at 64ch. On the home screen that left a
panel holding a whole change feed sitting at **605px inside a 1120px band**,
bunched against the left edge with 450px of nothing beside it, and every feed row
wrapping onto three lines for no reason.

The prose classes already cap themselves, so:

- **A panel holding prose is the right width without being told.**
- **A panel holding a table, a feed or a grid is free to use the space it needs.**

Where a specific panel really should be narrow, add `.u-measure`. Do not put a
measure on a container that might one day hold something other than a paragraph.

After the change, the only blocks narrower than their band are `.t-doc` and
`.t-doc-sm`, which is exactly right.

## Every tool page uses the same skeleton

Nothing below is per-tool. A new tool writes its content into this and inherits
the rhythm, the measure, the grounds and the type without deciding anything.

```html
<section id="v-<tool>">
  <div class="band band--a band--first"><div class="band__in">
    <h1 class="t-page">Tool name</h1>
    <p class="t-doc">One line saying what this screen answers.</p>
    <div class="stats">…three headline figures…</div>     <!-- optional -->
    <div class="strip">…when it last ran, when it runs next…</div>
  </div></div>

  <div class="band band--b"><div class="band__in">
    <h2 class="t-section">A section</h2>
    <p class="t-doc-sm">One line, only if it says something the heading cannot.</p>
    …tables, pairs, panels…
  </div></div>

  <div class="band band--dark"><div class="band__in">
    …the thing the reader came for. One dark band per screen…
  </div></div>

  <div class="band band--a band--last"><div class="band__in">
    …what we looked at, and the feedback block…
  </div></div>
</section>
```

Bands alternate `--a` and `--b`. One `--dark` per screen, and it goes to whatever
the reader came for. `--first` and `--last` tighten the top and open the bottom.


## Specificity has cost three bugs in two days. Check it.

Every one of these looked right in the file and failed silently in the browser,
because a rule that loses on specificity or source order produces no error:

| What broke | Why |
|---|---|
| A second heading inside a band came out at 32px, not 64 | The flow rule tied on specificity and sat later |
| An intro line sat 32px from what it introduces, not 16 | Same |
| The suggestions line ran 340px off the right edge | `.addbar p` is class-plus-element, `.addbar__hint` is a bare class. `flex:none` kept winning, so it could not shrink |

**When a rule does not take, check what it is competing with before changing the
value.** Changing `flex-basis` three times will not beat `flex-shrink:0` from a
selector one notch heavier. The fix was `.addbar p.addbar__hint`, not a different
number.

**Two habits that prevent it:** name the element in the selector when the rule it
overrides does (`p.addbar__hint`, not `.addbar__hint`), and put every override
after the rule it overrides rather than trusting it to win.

## A breakpoint rule that lists its children breaks the next time you add one

The feed row is a four-column grid on desktop: label, text, meta, chevron. The
first mobile rule collapsed it by naming the children that had to move, `.t-row`
and `.t-meta`. It read fine and it was wrong: `.t-kind`, the BEHIND / AHEAD
status label, was never named, so it stayed in the 16px chevron column and
rendered as "BEHIN". Nobody had touched that rule since; the row had gained a
child.

So the rule moves every child and exempts the one that stays:

```css
.feed__row > *{grid-column:1}
.feed__chev{grid-column:2; grid-row:1 / -1}
```

An allow-list of children that move has to be edited every time the markup
changes, and nothing fails when you forget. A deny-list of the one child that
does not move keeps working. Write the collapse as "everything stacks, except
this", never as "these three stack".

## How to actually test a breakpoint here

The preview pane will not narrow below 980px, so `resize_window` reports success
and `innerWidth` stays at 980. Every `@media (max-width:640px)` rule is dead
during the test and the page looks fine because none of it applied. Two
measurements were taken that way before the trap showed itself.

Render the page in a fixed-width iframe instead. Media queries evaluate against
the iframe's own width, so the mobile rules genuinely apply:

```js
const f = document.createElement('iframe');
f.src = '/workspace.html';
f.style.cssText = 'width:390px;height:844px';
document.body.appendChild(f);
// f.contentWindow.matchMedia('(max-width:640px)').matches === true
```

Then assert on overflow rather than on screenshots. For every element, flag it
when its right edge passes the viewport **and** no ancestor has `overflow-x`
of `auto`, `scroll` or `hidden`. The second half matters: `.tabs` and
`.tablewrap` both scroll on purpose, and their children are supposed to run
past the edge. Without that check the scan reports 38 failures on a page that
is correct.

## A hidden preview pane lies, and it lies differently in three ways

Both sessions lost time to this on 15 September, so it belongs next to the
iframe method above rather than in either session's head.

When the Browser pane is hidden or collapsed, the page is still *there* — the
DOM is live, `querySelector` works, rules match — but nothing paints. Three
separate consequences, and each one looks like a bug in the CSS:

**1. Geometry reads as zero.** `clientWidth: 0`, `innerWidth: 0`. An overflow
scan then reports every element on the page as overflowing, because everything
is wider than a zero-width viewport. That is sixty phantom bugs and not one
real one. **Check `document.documentElement.clientWidth > 0` before believing
any measurement**, and abandon the run if it is zero.

**2. Transitions never advance, so `getComputedStyle` sits at the start value
for ever.** This one is nastier, because it produces a *plausible* wrong answer
rather than an obvious one. A pressed `.toggle` reported `background:#ffffff`
and no `box-shadow` — its unpressed values — while correctly reporting
`font-weight:600` from the very same rule. The difference was that
`font-weight` is not in the element's `transition-property` list, so it snaps,
while `background-color` and `box-shadow` are, so they were still pinned at
frame zero forty minutes later. Waiting longer does not help: with no paint
there is no clock.

The diagnosis was one line — set `transition:none !important` and read again.
If the value is suddenly right, the rule was always right and the pane was the
problem. **Measure a transitioned property only with transitions disabled.**

**3. `requestAnimationFrame` never fires.** A promise waiting on one never
settles and the call times out at 45 seconds. Never `await` a rAF in a probe;
use `setTimeout`, or force layout with `void el.offsetHeight`.

The honest summary: a hidden pane is fine for reading the DOM and for anything
static, and worthless for anything about geometry, animation or time. Screenshots
come back blank, so it cannot be checked by eye either. If a measurement
surprises you, suspect the pane before the stylesheet.

## A row that does nothing must not look like one

Found on the Planner's month spine on 15 September: five `.feed__row` buttons
with chevrons, three of them weeks not written yet. There was nothing for a
chevron to open. The same thing is true of the Tracker's three "What moved"
rows today — they are buttons, they take a pointer cursor, they light up on
hover, and no handler is attached to `.feed__row` anywhere in the script.

The component was not wrong. The affordance was a promise the screen could not
keep, which is `.card__head`'s sibling problem wearing different clothes: a
rule that is right in general applied where its precondition does not hold.

`.feed__row--static` removes the cursor, and the hover rules are written
`:not(.feed__row--static)` so a static row does not light up. **If a row ever
does open something, only that row gets the affordance** — the default is
static, and the interactive case is the one that has to be declared.

## Say it once means once, not twice

The existing rule was written against a screen saying something twice. It turns
out to need the stronger form, because a screen can say the same thing three
times and each one looks defensible on its own. The Planner had two unwritten
blanks marked in amber where they occurred, counted in a stat tile, **and**
listed again in a section of their own.

The general form:

> A thing is **marked where it is**, **counted where the count is useful**, and
> **listed separately only when the document is long enough to scroll past it.**

Three appearances is almost always one too many. The list is the one to cut,
because it is the only one of the three that carries no new information and no
position.

## Two edit habits, learned by losing a section

Both screens live in one large HTML file and are maintained by string
replacement. That is fine until it is not:

**Assert on every replacement.** An edit whose pattern matched one of its two
targets and silently did nothing for the other left a function called and never
defined. A replacement that quietly matches nothing is the default behaviour of
every string-replace tool there is. Count the matches and fail if the count is
not what you expected.

**Never delete by range.** Replacing "from here to there" with nothing swallowed
the band after the target and a whole section, "What we did not write",
disappeared from the screen. Delete a named, bounded thing.

Neither failure was caught by the test suite, because nothing asserted what
sections a screen has. `tests/structure.test.ts` does now, at H1 and H2 level,
plus band counts and the `band--first` / `band--last` pair. That test is
deliberately a list that has to be edited when a section is deliberately
removed: the friction is the point, and it is the one place in this codebase
where an allow-list is the right answer rather than the wrong one.

## A shared script plus a shared class name is the `.why` collision again

The specificity section below records a chip class and a paragraph class sharing
the name `.why`, which set three sentences in uppercase bold. Renaming the chip
fixed it and the lesson was recorded as a CSS problem. It is not only a CSS
problem.

On 15 September the Tracker's feedback toggles were renamed from `.fb__toggle`
to the shared `.toggle`, and the handler in the page script read:

```js
document.querySelectorAll(".fb__toggle")   // about to become ".toggle"
```

A bare `.toggle` would have matched the Content planner's four cadence controls
too, because `querySelectorAll` runs over the whole document and does not care
whose section an element sits in. Clicking "Too salesy" on one screen would have
silently reset the posting cadence on another. The fix was one selector:

```js
document.querySelectorAll(".fb .toggle")
```

**When two components share a class, every global selector that touches it has
to be scoped to a container, in CSS and in script alike.** The CSS case is
loud, you see it. The script case is silent, and it corrupts state rather than
type. Both pages are driven by one `<script>` at the foot of `workspace.html`,
so this will keep arising as the class vocabulary is consolidated.

## Name a modifier after something that exists

`.btn--ghost` and `.btn--sm` are written as modifiers of `.btn` and used in the
markup **without** `.btn`, so for weeks they never inherited its
`border-radius` and every secondary button in the suite rendered square beside
pill-shaped ones. Nobody saw it, because a square button looks like a decision.

Two things came out of fixing it. The rule is now grouped,
`.btn,.btn--ghost,.btn--sm{border-radius:var(--r-pill)}`, rather than requiring
the base class in the markup: a modifier that only works when someone remembers
to write the base is the same trap wearing a hat. And there is a test — any
`--modifier` used without its base class, where the base is a real rule, must be
grouped with that base somewhere in the file.

Still outstanding under this heading: `kind--good`, `kind--bad` and
`kind--block` read as modifiers of a `.kind` that does not exist. They pair with
`.t-kind`. Nothing is lost today, because they only set colour, but it is the
shape that hid `.btn--ghost` for weeks. `t-kind--good` would say what is true.
