/**
 * One place that reads the environment.
 *
 * EVERY NAME BELOW IS WRITTEN OUT IN FULL, AND THAT IS NOT A STYLE CHOICE.
 * Next replaces `process.env.NEXT_PUBLIC_THING` in browser code by finding that
 * exact text and substituting the value. A lookup through a variable,
 * `process.env[name]`, is not that text, so it is never replaced and is always
 * undefined once the code reaches a browser.
 *
 * This file used to do exactly that. It worked on the server, so every build
 * passed and every page rendered. The sign-in screen then failed in the browser
 * with "Missing NEXT_PUBLIC_SUPABASE_URL" while the variable was plainly set.
 * Found by clicking the button, which no amount of type checking would have
 * caught. `test/env.test.ts` now fails if the dynamic form comes back.
 *
 * Supabase renamed its keys: `anon` became `publishable`, `service_role` became
 * `secret`. Both spellings are accepted, because which one your dashboard shows
 * depends on when the project was made.
 */

function need(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing ${name} in .env.local. Copy .env.local.example and fill it in. See SETUP.md.`,
    );
  }
  return value;
}

export const supabaseUrl = () =>
  need(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");

export const publishableKey = () =>
  need(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );

/** Server only. Ignores Row Level Security, so it must never reach a browser. */
export const secretKey = () =>
  need(
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );
