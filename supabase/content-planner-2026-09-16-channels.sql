-- Where this business actually posts.
--
-- Nothing asked and nothing recorded it. The Planner read the words
-- "instagram", "facebook" and so on out of the business's own page text and
-- took that as the answer, which worked for a barber whose home page happens to
-- say "contact us through Facebook and Instagram" and produced nothing at all
-- for a business whose copy never names a platform.
--
-- CLAUDE.md 2 has always said these are detected and then shown for
-- confirmation. Detection without the confirmation is a guess we never told
-- them we were making, and a month planned for the wrong place is a month
-- wasted.
--
-- On the workspace, not on the tool's own table: where they post is a fact
-- about the business, and the other five tools have the same right to it as
-- this one. Same reasoning as the voice note.
--
-- Named, not numbered: CLAUDE.md 1.4b.

alter table public.workspaces
  add column if not exists channels text[];

comment on column public.workspaces.channels is
  'Where they post, confirmed by them. Null means never asked; an empty array '
  'means asked and they post nowhere, which is a different thing.';
