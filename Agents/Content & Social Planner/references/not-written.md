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

    What you have posted
    How often we suggest you post
    What you sound like
    This week
    Resize a photo
    The rest of the month
    What we did not write

The screen holds two things the document does not, and neither belongs in a file
sent to a customer: what has gone out so far, and the resizer.

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
