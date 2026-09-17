---
paths:
  - "web/tools/**"
  - "web/lib/**"
  - "web/app/**"
  - "web/supabase/**"
---

# 1.4b Six tools, six sessions, no collisions (added 2026-09-16)

<!-- Moved out of CLAUDE.md on 2026-09-17. That file loads in every session and was over
     Anthropic's documented 200 line target; a path-scoped rule loads only when a
     matching file is touched, which an @import would not. See ARCHITECTURE.md
     section 1. Nothing was cut. -->

Each tool is meant to be built independently. What stopped that, and what each
one now costs:

1. **The engine named the tool.** It imported the Competitor Tracker's stages,
   playbook and document, and wrote its slug into the row, so every new tool
   meant editing `lib/engine.ts` and two sessions collided on their first
   commit. The engine now looks the tool up by the slug already on the run and
   calls the contract in `tools/contract.ts`. It names no tool, and a test in
   `test/contract.test.ts` fails if it ever does again.

2. **A tool owns its folder and nothing else.** `tools/<slug>/` holds its
   stages, its document, its own tests and its own fixtures. A tool importing
   another tool's files makes two sessions dependent without either touching a
   shared file, so a test forbids it.

3. **Migrations are named, not numbered.** A running number means two sessions
   both write `013` and one silently loses. Name them
   `<tool>-<date>-<what>.sql`. The already-applied numbered ones keep their
   names: renaming would make them all look unapplied.

4. **Some files are read-only to a tool session.** `app/design.css`, the tokens,
   `app/layout.tsx`, the workspace shell, `lib/engine.ts`, `lib/watchdog.ts`,
   `lib/plainly.ts` and the guards. A tool that needs one changed asks rather
   than changing it. This is the lock `UI/CLAUDE.md` 6c already describes,
   applied to `web/`.

**What a new tool costs, in full:** one folder, one line in
`tools/registry.ts`, and `built: true` when it works. Nothing else.

**Styling is never a tool's business.** Every colour, size and space is a token
in `app/design.css`, and a test refuses a hex or a `font-family` inside a tool.
See 1.4a.
