-- What the owner did to a plan, kept apart from the plan itself.
--
-- A document is what we produced. This is what they did with it: the wording
-- they changed, the posts they marked as gone out with the link, and the
-- corrections they made to how we write for them.
--
-- Kept in its own table rather than written back into the document, for the
-- reason CLAUDE.md 5 gives: a post the owner has edited is never overwritten,
-- and that promise is easier to keep when their words and ours are not in the
-- same field. The next plan reads this; it does not replace it.
--
-- Named, not numbered, per CLAUDE.md 1.4b: two sessions both writing 013 means
-- one of them silently loses.

create table if not exists public.content_post_state (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,

  -- The slot, not the document. A plan is remade every thirty days and the
  -- fact that they posted on the 17th outlives the document that suggested it.
  post_date     date not null,
  channel       text not null,

  -- Their words. Null means they kept ours. Never overwritten once set.
  edited_words  text,

  -- Marked as gone out, with the link they pasted. CLAUDE.md 6a: this needs no
  -- connected account and gives us the caption as published.
  posted_at     timestamptz,
  posted_url    text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (workspace_id, post_date, channel)
);

create index if not exists content_post_state_workspace_idx
  on public.content_post_state (workspace_id, post_date);

alter table public.content_post_state enable row level security;

drop policy if exists "your own post state" on public.content_post_state;
create policy "your own post state"
  on public.content_post_state for all
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));

-- How we write for them, corrected by them.
--
-- On the business rather than inside a plan, because a correction made in
-- September still holds in January and the other five tools read it too. That
-- is the whole reason the voice note is worth keeping: CLAUDE.md 2a.

create table if not exists public.content_voice_note (
  workspace_id  uuid primary key references public.workspaces(id) on delete cascade,

  -- What we read off their site. Replaced whenever we read it again.
  read_off      text,

  -- Named corrections, from the fixed list in CLAUDE.md 5. A count is
  -- actionable and a mood is not, which is why this is not a free text box.
  corrections   text[] not null default '{}',

  -- Their own words, underneath the list. Optional, and never the only input.
  in_their_words text,

  updated_at    timestamptz not null default now()
);

alter table public.content_voice_note enable row level security;

drop policy if exists "your own voice note" on public.content_voice_note;
create policy "your own voice note"
  on public.content_voice_note for all
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));
