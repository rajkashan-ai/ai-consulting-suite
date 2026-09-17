# House style, enforced rather than asked for

<!-- Moved out of ../CLAUDE.md on 2026-09-17. That file was 403 lines against
     Anthropic's documented target of under 200, and their guidance is explicit that a
     longer file consumes more context and reduces adherence to itself. A sibling file
     here loads only when somebody opens it. See ARCHITECTURE.md section 1.
     Nothing was cut: this is the section as it stood. -->

**A dash is mechanical, a word is not, so they are handled differently.**

An em dash or an en dash between words is punctuation, and swapping it for what a
person would have typed changes nothing else in the sentence. So it is repaired,
silently and deterministically: a comma, or a full stop where the dash was doing
a full stop's work. Dropping a finished post over a typographic mark would cost
the owner a post to fix a keystroke.

**AI speak is a word choice and there is no safe swap**, so a post carrying one
is refused the same way an invented claim is, and the reason says which word.
"Leverage" is not a worse way of saying something true; it is the sentence a
person would not have written, and rewriting it here would be us guessing what
they meant.

**Asked for in the schema as well as the prompt.** A length or a ban asked for
politely drifts (`CLAUDE.md` 1.4a). The schema pattern refuses a dash outright,
so the model usually cannot return one in the first place, and the check
afterwards exists because a schema is the model's constraint and not a promise.

The list is `HOUSE` in `web/tools/content-social-planner/scrub.ts`, beside the
guards it runs with. It is the root `CLAUDE.md` §10 list plus the words that
turn up in social copy.
