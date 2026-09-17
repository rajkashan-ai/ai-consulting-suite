---
paths:
  - "web/app/**"
  - "web/tools/**"
---

# 1.4a Readable by an owner, not just correct (added 2026-09-16)

<!-- Moved out of CLAUDE.md on 2026-09-17. That file loads in every session and was over
     Anthropic's documented 200 line target; a path-scoped rule loads only when a
     matching file is touched, which an @import would not. See ARCHITECTURE.md
     section 1. Nothing was cut. -->

Correct and unreadable is not done. The first finished comparison was accurate in
every cell and Raj's verdict was "at present I wouldn't read it". Every fault in it
maps onto a published heuristic, so we use the published ones rather than inventing
house rules: **Nielsen's 10 Usability Heuristics** for the interface
(`nngroup.com/articles/ten-usability-heuristics/`), and **SVPG** for what we choose to
build, in particular that the test of a feature is whether a real user can get value
from it unaided, not whether it shipped.

The four we broke, and the rules that come out of them:

1. **Say a thing once.** (Nielsen 8, aesthetic and minimalist design: "interfaces
   should not contain information that is irrelevant or rarely needed".) Every cell
   printed its source and date, thirty repetitions of the same eight words in one
   table. Repeated support belongs in the header, the footer, or a footnote. It moves,
   it does not go: a claim nobody can check is a claim nobody believes.
2. **A row exists to be read across.** (Nielsen 6, recognition rather than recall.)
   The comparable fact is first and loudest in every cell, in the same place in each,
   and numbers use `tabular-nums` so digits sit under digits. Comparing two prices must
   never mean reading two sentences and holding them in your head.
3. **A heading is the answer, not the label.** People read the heading and stop. "You
   put five prices in plain sight" is a label. "You publish 5 prices, they publish 2"
   is the finding. Cap it in the schema, because a length asked for in prose drifts.
4. **Never show our own references.** (Nielsen 2, match between the system and the real
   world.) "(page 3)" is our machinery: the reader cannot see page 3. This is section
   7.7 of `UI/CLAUDE.md` in another costume.

**Enforce it on the shape, not in the prompt.** A cell that must be short gets
`maxLength` in its JSON schema. Asking politely produced full sentences every time.

**Every one of these has a test** in `web/test/readable.test.ts`, asserting both the
shape we ask the model for and what the screen does with it. Both have to hold: a
short value rendered badly is still unreadable, and a beautiful table full of
sentences is still unreadable.

Apply all of this to the other five tools before they are built, not after.
