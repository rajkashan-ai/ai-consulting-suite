-- Run after 001_schema.sql. Once. There is no second step.
--
-- This is the only thing between a public URL and a stranger's account.

-- -----------------------------------------------------------------------------
-- Who may sign in, and who is staff
--
-- staff is set here rather than on the profile, so this file runs once and is
-- finished. The earlier version updated public.profiles, which does not exist
-- until a person first signs in, so it had to be run twice and reported
-- "UPDATE 0" the first time. That looks like a failure and is not, and nobody
-- should have to know that.
--
-- The trigger in 001_schema.sql copies this across at sign-in.
-- -----------------------------------------------------------------------------
alter table public.allowed_emails
  add column if not exists staff boolean not null default false;

insert into public.allowed_emails (email, note, staff) values
  ('rajkashan@gmail.com',          'Raj, personal. Test account',  true),
  ('rajkashan@highintentlabs.com', 'Raj, work. Test account',      true)
on conflict (email) do update
  set staff = excluded.staff,
      note  = excluded.note;

-- Both are let straight in and both are staff, which means: point the tools at
-- any website, hold as many businesses as you like, and switch between them.
-- A customer gets one business and no chooser.
--
-- They are still two separate accounts with separate data. Nothing links them,
-- because matching people up by name would be us guessing at identity.

-- -----------------------------------------------------------------------------
-- Adding a tester later
-- -----------------------------------------------------------------------------
--   insert into public.allowed_emails (email, note) values ('them@example.com', 'who they are');
--
-- Removing one stops a new sign-in but does not end a session they already
-- hold, so also delete their user under Authentication if you mean it now.
