# The planner screen: design spec

> From a ux-designer pass on 2026-09-15, after Raj said the screen was flat and
> monotone beside the Competitor Tracker. **Nothing here is invented.** It applies
> `UI/design-rules.md`, and every genuinely new class carries the argument for why
> the standard lacks it.
>
> **Landed 2026-09-15**, in one window with `app.css` held exclusively, after the
> Competitor Tracker session handed it over. Protocol agreed with that session:
> serialised ownership of `app.css` and the shared `<script>`, `#v-content` mine
> and `#v-comp`/`#v-home` theirs, sync run only by whoever holds the file, and
> `npm test` from the Tracker read on the `ℹ fail 0` line rather than the `✖`
> header, which the todo case prints on a green run.
>
> **The screen it describes has since changed shape**, because the product did on
> the same day: a recommended cadence rather than an asked one, and a week at a
> time rather than a month. `CLAUDE.md` §2b and §3.

---

## The diagnosis, in the standard's own words

`design-rules.md`, "Flat is a scale problem, not a shadow problem": every figure
at body size and every block the same width. Not a shadow problem. Measured on
this screen:

- No figure above body size anywhere except the page title.
- Nine post cards of identical width and identical weight.
- `btn--ghost` 38 times and `btn--sm` 36 times. **26 per cent of every class use
  on the screen is the 36 critique buttons.**
- None of `.stats`, `.band--dark`, `.glyph`, `.kind--good`, `.linkish`, `.t-lead`.
- No `.btn` at all, so one berry element out of a budget of three, and no way to
  approve a plan that §5 says is never final until approved.

## The ten changes, in order, each shippable alone

1. **Three `.stats` tiles and a `.t-lead`.** `5 of 9 posts / Need a line from you`
   takes the 2fr box: it is what the page argues about and the only figure the
   owner can act on. Then `2 a week` and `1 of 9 asks for a booking`. One colour,
   `--warn`, because five blanks are waiting on them, not failing.
2. **The last band becomes `band--dark`**, with the one `.btn`, "Approve the
   month", in a white card inside it. Not on the navy: berry on navy is 1.43:1.
   The posts cannot take the dark band, because nine white cards over 2,000px of
   dark ground is a second ground, not an emphasis.
3. **Delete all 36 critique buttons.** Five named critiques once, under the voice
   panel they correct. The rule: **a control may repeat per card only if it acts
   on that card alone**, and a critique rewrites six other posts and outlives the
   plan. Cost, accepted: an owner at post 7 scrolls back once.
4. **Two-up the post grid, first card spans the row.** The `.actions` rule the
   tracker was levelled up with. 480px column at the shell width is 51
   characters, inside the 45 to 75 band. One column at ≤1024.
5. **Edit and Done per card**, and "Why this one" demoted to one `.t-meta` line
   in the footer. Nine inset surfaces and nine uppercase labels go.
6. **Cut 173 words.** Two lines go in full: "Nothing here is about LinkedIn or
   video" and the whole "The actual words, long enough to paste straight in"
   lead-in.
7. **The month table becomes a four-row `.feed` spine**, so the page can navigate
   itself and the 680px mobile scroll goes.
8. **Consolidate the classes I invented.** See §Shared.
9. **Split the closing band**: the five blanks become `.feed__row`s on the dark
   band, each jumping to its post; the four disclosures stay as one card list.
10. **Add the `.fb` feedback block.** This is the only tool screen without one.

## Shared: what touches the Competitor Tracker

Nothing below may land without the Competitor Tracker session agreeing, because
all of it is `app.css` or its screen.

| Change | Why it is shared |
|---|---|
| `.card__head .t-card + *{margin-top:0}` | Fixes 18 elements here **and their add bar**, where `.addbar p.t-card` shoves `.field` down 12px. Must sit right after `.card__head + *` or it loses on source order |
| `.swap` → `.confirm` | They use `.swap`, and it does two jobs |
| `.fb__toggles`/`.fb__toggle` → `.controls`/`.toggle` | They use both |
| `aria-checked` → `aria-pressed` | Invalid ARIA on a `<button>` with no role, on both screens |
| `.pair li` → `.card > ul > li, .pair li` | Widens a rule they rely on |
| `.stats > :first-child{grid-column:1 / -1}` at ≤900 | Their 2fr tile currently drops to half width with one tile beneath |
| `.t-lead + .stats` in the lead-in list | Their tiles sit 32px from their lead-in, not 16px |

**New shared components**, each argued: `.card__body` (no padded card body exists,
and all six tools will render a document in one), `.inset` (`.strip`,
`.action__ev` and my `.post__note` are the same surface under three names),
`.card__foot` (`.post__crit`, `.fb__send` and `.swap__actions` are the same row),
`.u-push` (five one-off classes for `margin-right:auto`), `.blank` (renames
`.gap`, which collides with the CSS property), `.stat--warn`, `.field--text`.

**Two defects on their screen** the pass found: their opening band is missing
`band--first`, and their line under `.t-page` should be `.t-lead`, which is used
zero times in the whole app.

## What I got wrong building it

I invented `.post`, `.post__head`, `.post__body`, `.post__note`, `.post__when`,
`.post__crit` and `.gap`. `.post` was byte-identical to `.card`. Three of the
others already existed under another name. The standard had grown `.stats`,
`.band--dark` and `.linkish` while I was working and I used none of them.
**Check what the standard has before adding to it.**


## What actually shipped, and what the spec got wrong

Landed as specified: the three `.stats` tiles, the one dark band, the 36 critique
buttons cut to five, Edit and Done per card, the `.feed` spine, the class
consolidation, and the primary action. Verified in a fixed-width iframe at 1280,
900 and 390: zero overflow, mobile queries genuinely applying, rhythm at 16 / 12
/ 4 / 0 where the standard says, seven sizes and two weights, and every
consolidated component computing identically on the Tracker's screen.

**Two things the spec got wrong.**

1. **The add bar.** The spec said `.card__head .t-card + *{margin-top:0}` would
   fix the Tracker's add bar as well. It cannot: `.addbar` is a sibling of the
   table and no ancestor is a `.card__head`. The defect was real and the scope
   was wrong. The Tracker session caught it and fixed it at `.addbar > * + *`.
   **The rule is still right for this screen's own 18 elements.**
2. **The dark band goes to this week's posts, not the blanks.** The spec put it
   on the blanks because nine white cards over 2,000px of dark ground is gutter
   rather than emphasis. With two posts a week that reasoning no longer holds,
   and the posts are what the reader came for.

**One thing not done by eye.** The browser pane was collapsed for the whole
session, `clientWidth: 0`, so every screenshot came back blank and an overflow
scan returned every element as a failure. Everything above is computed styles and
geometry. The screen has not been looked at.
