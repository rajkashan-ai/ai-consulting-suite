-- Brand Persona: how this business sounds, and the choice of sounding otherwise.
--
-- It was two sentences of prose in content_voice_note.read_off, read off their
-- website, shown near the bottom and used quietly by the writer. A website is
-- often written by whoever built it in 2019; their own posts are how they
-- actually talk, and nobody was ever asked for one.
--
-- Added to content_voice_note rather than put in a table of its own: it is one
-- row per workspace saying how to write for them, which is exactly what that
-- table already is. A second table would be a second place to look.

-- Their own posts, pasted. Their words, freely given: Instagram and Facebook
-- both disallow us in robots.txt, so a handle cannot be read however much
-- anybody wants it to be, and this is the owner handing us their writing
-- rather than a way around the block.
alter table public.content_voice_note
  add column if not exists samples text[] not null default '{}';

-- A page whose writing they admire. A website or a blog; never a social
-- account, for the same reason.
alter table public.content_voice_note
  add column if not exists inspiration text;

-- The persona itself, in parts they can disagree with: tone, the everyday
-- words they use, the ones they never reach for, and how they build a
-- sentence. Prose could not be corrected because there was nothing in it to
-- correct.
alter table public.content_voice_note
  add column if not exists persona jsonb;

-- Which of the five they chose, or 'original' for the voice we read off what
-- they gave us. Constrained here as well as in the action, so a style nobody
-- built cannot be stored by a later caller who forgets.
alter table public.content_voice_note
  add column if not exists style text not null default 'original';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'content_voice_note_style_known'
  ) then
    alter table public.content_voice_note
      add constraint content_voice_note_style_known
      check (style in ('original', 'expert', 'warm', 'direct', 'uplifting', 'story'));
  end if;
end $$;

-- When the persona was last worked out, so a screen can say how old it is
-- rather than implying it is current.
alter table public.content_voice_note
  add column if not exists persona_at timestamptz;

comment on column public.content_voice_note.samples is
  'Posts the owner pasted. Their own words: the platforms disallow reading.';
comment on column public.content_voice_note.persona is
  'Tone, words used, words avoided, sentence style. Parts they can disagree with.';
comment on column public.content_voice_note.style is
  'One of the five, or original for the voice read off what they gave us.';
