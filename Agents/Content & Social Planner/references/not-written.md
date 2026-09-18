# What we deliberately did not write, and why

<!-- Moved out of ../CLAUDE.md on 2026-09-17. That file was 403 lines against
     Anthropic's documented target of under 200, and their guidance is explicit that a
     longer file consumes more context and reduces adherence to itself. A sibling file
     here loads only when somebody opens it. See ARCHITECTURE.md section 1.
     Nothing was cut: this is the section as it stood. -->

   Every gap with its reason beside it. Never a gap on its own.
```

**That list is the exported document**, which leaves the app and goes to their
customers. `tests/contract.test.ts` asserts the export carries exactly it, in
order, because a section can otherwise vanish and no test notices, which happened
to this export before anything checked.

### The screen is a different list, and it is also a contract

    This week
    Resize a photo
    The rest of the month

The screen holds one thing the document does not, and it does not belong in a
file sent to a customer: the resizer.

**Four sections were removed on 2026-09-18, on Raj's instruction**, and are not
coming back by accident: "What you have posted", "How often we suggest you
post", "What you sound like" and "What we did not write", along with the summary
strip and the three number cards above them. How they sound is now Brand Persona
at the top of the page, which is why the old voice section went. Cadence is
fixed at whatever we recommend: the owner no longer sets it, so the picker and
the `changeCadence` action went with the section. Removing a section from this
list is the only way to remove one from the screen, which is the point of the
list.

**The resizer was on neither list until 2026-09-16 and was therefore dropped**,
silently, when the screen was rebuilt for the app. It had been built, tested and
on the mockup, and the contract that was supposed to protect it had never been
told it existed. A section on no list is a section nobody is keeping.

**This list is the contract**, and `tests/contract.test.ts` asserts the export carries exactly it,
in order. A section can otherwise vanish and no test notices, which happened to the screen on
15 September and to this export before anything checked.

**Finished posts, not hooks.** Each entry is the actual caption, long enough to paste straight in.
A theme and an opening line is still a blank page, and the blank page is the whole problem.

**Every post carries a shot instruction.** One line, plain: "a photo of the boiler before and
after, taken on your phone in daylight". We write the words, they supply the proof.

**We do not generate images.** A photo of a tradesperson who is not them, on a job that never
happened, is the same fabrication as an invented case study.

**Each post is written for its channel**, not written once and pasted three times. LinkedIn runs
long and takes a view, Instagram leads with the image, a Google Business Profile post is an offer
or an update. Word targets and character caps are in `src/types.ts`.
