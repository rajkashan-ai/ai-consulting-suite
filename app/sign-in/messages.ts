/**
 * The words the sign-in screen says when something goes wrong.
 *
 * In its own file, with no JSX in it, so it can be tested directly. Node's type
 * stripping does not handle .tsx, so a pure function living inside a component
 * file is a pure function nothing can test.
 */

/**
 * Supabase's errors are written for whoever is building the app. These are for
 * whoever is trying to get in, and each one says what to do next.
 *
 * None of them says whether the email exists. That answer would turn this form
 * into a way of finding out who our customers are, by typing addresses in and
 * watching which ones behave differently.
 *
 * The not-set-up case is the exception, and it is aimed at us. On 15 September
 * this said "That did not work, try again" when there was no Supabase project
 * behind the app at all. Trying again could never have worked, and a message
 * that vaguely blames itself sends whoever reads it looking in the wrong place.
 */
export function readable(message: string): string {
  const m = message.toLowerCase();

  // The browser could not reach Supabase. Each browser words this differently,
  // so it is matched on several spellings rather than one.
  if (
    m.includes("failed to fetch") ||
    m.includes("fetch failed") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("err_name_not_resolved")
  ) {
    return "Cannot reach the sign-in service, so this is not set up yet rather than wrong. See SETUP.md.";
  }

  if (m.includes("next_public") || m.includes(".env.local")) {
    return "This app has no Supabase project behind it yet. See SETUP.md.";
  }

  if (m.includes("not_invited") || m.includes("42501") || m.includes("database error")) {
    return "That email is not on the list yet. Ask Raj to add it.";
  }

  if (m.includes("expired") || m.includes("invalid")) {
    return "That code is wrong or has expired. Ask for a new one.";
  }

  if (m.includes("rate") || m.includes("many")) {
    return "Too many tries. Wait a minute and go again.";
  }

  return "That did not work. Try again, and tell Raj if it keeps happening.";
}

