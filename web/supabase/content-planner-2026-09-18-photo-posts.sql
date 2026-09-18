-- Posts written from a photo the owner supplied.
--
-- The photo itself is not here, and there is no bucket for it anywhere. It is
-- downscaled in their browser, carried inside the one API call that writes the
-- post, and gone. What is recorded is that a photo was behind it and which of
-- their own services it showed, because those two things decide what the post
-- says it was written from.
--
-- WHY THE CREDIT NEEDED A SECOND HALF
-- Every post already carries the page on their site that backs it. A post
-- written from a photo describes work that no page of theirs describes, so
-- stamping it "from your own page" would point the receipt at something that
-- does not say it. The page still backs the price and the booking line. The
-- photo backs the look. Both are recorded, and the screen says both.

-- 'asset' was refused by the check from the first migration, because nothing
-- uploaded a file. It does now.
alter table public.content_made
  drop constraint if exists content_made_path_check;

alter table public.content_made
  add constraint content_made_path_check
  check (path in ('category', 'thought', 'asset'));

-- Whether a photo was behind it. Set by the action from what it was handed,
-- never by the model: the writer cannot be allowed to claim a source.
alter table public.content_made
  add column if not exists from_photo boolean not null default false;

-- The date the photo was used, which is the date the post was made. Kept
-- separately from source_on so the credit line can say both dates without
-- either being inferred from the other.
alter table public.content_made
  add column if not exists photo_on date;

-- Which of their own services the photo showed, in their words, off their own
-- page. Free text because the list comes from their site and not from us.
alter table public.content_made
  add column if not exists service text;

-- A photo post says so and says when. Anything else must not claim one.
alter table public.content_made
  drop constraint if exists content_made_photo_check;

alter table public.content_made
  add constraint content_made_photo_check
  check (
    (from_photo and path = 'asset' and photo_on is not null and service is not null)
    or (not from_photo and photo_on is null and service is null)
  );

comment on column public.content_made.from_photo is
  'A photo the owner supplied was behind this post. The photo is never stored: '
  'it is downscaled in the browser, sent inside the writing call, and forgotten.';
