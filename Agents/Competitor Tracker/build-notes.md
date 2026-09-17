# Build notes for the first version

> Split out of `CLAUDE.md` on 2026-09-14, when that file passed its 200-line cap.
> These are read once, while building. The rules in `CLAUDE.md` are read every
> time, which is why they stay there and this does not.

---

Keep it simple. This is the skeleton.

- Self-contained. The strategies do **not** link out to the other tools yet. Write them so they map
  cleanly onto Pricing, Content and the website tool, and wire the buttons in a later pass.
- No workspace switcher. One business, theirs.
- The weekly re-check runs itself. No "Run scan" button. On a first run there is nothing to compare
  against, so the "Since" section is simply absent.
- Export carries a `## Sources` block: every URL, the page title, the date fetched, and a staleness
  note on anything older than 30 days.
- Cost per run is logged. Estimate $0.50 to $2.00 until measured.


## For whoever builds the other five tools (2026-09-15)

Their first-use copy lives in the `EMPTY` template inside the `<script>` at the
foot of `UI/workspace.html`, not in the markup. Until 15 September no guard had
ever read it: every screen check stripped `<script>` first. `tests/screen.test.ts`
scans it now, but the shape of the trap is worth knowing before you add to it —
**what the customer reads is the boundary, not what is in the markup.**

And do not copy how the Swap-in box was built. It reimplements `src/candidate.ts`
in inline JavaScript instead of calling it, and the two contradicted each other
within hours of being written. Call the library.
