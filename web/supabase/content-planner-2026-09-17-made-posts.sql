-- Posts the owner asked for, rather than ones the month suggested.
--
-- The tool laid out thirty days and wrote a week of it. That is a calendar, and
-- a calendar a small business did not ask for produces guilt rather than posts.
-- The month stays as the prompter; this is what happens when somebody actually
-- reaches for the tool: a blank screen and a category, or a thing that just
-- happened and a sentence about it.
--
-- Separate from content_post_state on purpose. That table is the state of a
-- slot in a plan, keyed by the date and channel the plan proposed. These have
-- no slot: they exist because somebody asked at 4pm on a Tuesday.

create table if not exists public.content_made (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,

  -- How it was asked for: 'category' or 'thought'. 'asset' is on the screen
  -- and refused, so it should never appear here, and the check says so rather
  -- than leaving it to the action.
  path          text not null check (path in ('category', 'thought')),

  -- Why the post exists. Always set for 'category'; for 'thought' it is what
  -- the writing turned out to be, which is a finding rather than a choice.
  intent        text,

  -- What they typed, kept as they typed it. Their own words about their own
  -- business: not a claim we publish, and the thing to show them when they ask
  -- why a post says what it says.
  thought       text,

  -- The post. `words` is what they paste; the rest is how to shoot it and why
  -- it is worth posting.
  words         text not null,
  shot          text,
  why           text,

  -- The page on their own site that backs it, and when we read that page. A
  -- post with no source never reaches here: `unsafe` refuses it first.
  source_url    text not null,
  source_on     date,

  made_at       timestamptz not null default now(),

  -- Marked as gone out, with the link they pasted, the same way a planned post
  -- is. No connected account needed.
  posted_at     timestamptz,
  posted_url    text
);

create index if not exists content_made_by_workspace
  on public.content_made (workspace_id, made_at desc);

-- Row level security from the first migration, never retrofitted. CLAUDE.md
-- 1.4.3, and a test proves it rather than a policy.
alter table public.content_made enable row level security;

drop policy if exists "own made posts" on public.content_made;
create policy "own made posts" on public.content_made
  for all
  using (
    exists (
      select 1 from public.workspaces w
       where w.id = content_made.workspace_id
         and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
       where w.id = content_made.workspace_id
         and w.owner_id = auth.uid()
    )
  );

comment on table public.content_made is
  'Posts an owner asked for on the day, by category or from a rough thought. '
  'The month plan is the prompter; this is what they actually made.';
