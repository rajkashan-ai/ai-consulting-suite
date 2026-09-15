-- Run after 001_schema.sql.
-- This is the only thing standing between a public URL and a stranger's account.

-- -----------------------------------------------------------------------------
-- Who may sign in
-- -----------------------------------------------------------------------------
insert into public.allowed_emails (email, note) values
  ('rajkashan@gmail.com',           'Raj, personal'),
  ('rajkashan@highintentlabs.com',  'Raj, work')
on conflict (email) do nothing;

-- Two addresses, one person, and they are two separate accounts. Signing in
-- with one and then the other makes a second user with its own workspaces, so
-- pick one and stay on it unless you are deliberately testing what a fresh
-- customer sees. Nothing links them, on purpose: matching people up by name
-- would be us guessing about identity.

-- -----------------------------------------------------------------------------
-- Who may point the tools at any company
--
-- Run this AFTER signing in, because the profile row is made at first sign-in.
-- Before then it updates nothing and says "UPDATE 0", which is not an error.
--
-- is_staff is the whole of test mode: it holds more than one workspace and it
-- shows the business chooser. A customer has neither.
-- -----------------------------------------------------------------------------
update public.profiles
set is_staff = true
where lower(email) in ('rajkashan@gmail.com', 'rajkashan@highintentlabs.com');


-- -----------------------------------------------------------------------------
-- Adding a tester later
-- -----------------------------------------------------------------------------
--   insert into public.allowed_emails (email, note)
--   values ('them@example.com', 'who they are');
--
-- Removing one stops a new sign-in but does not end a session they already
-- hold, so also delete their user under Authentication if you mean it now.
