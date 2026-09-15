/**
 * One place that reads the environment, so a missing key fails loudly at the
 * first request instead of quietly behaving as if nobody is signed in.
 *
 * Supabase renamed its keys: `anon` became `publishable`, and `service_role`
 * became `secret`. Both names are accepted here because which one your
 * dashboard shows depends on when the project was made, and getting turned
 * away by your own app over a renamed variable is a bad first hour.
 */

function need(name: string, ...alternatives: string[]): string {
  for (const key of [name, ...alternatives]) {
    const value = process.env[key];
    if (value) return value;
  }
  throw new Error(
    `Missing ${[name, ...alternatives].join(" or ")} in .env.local. ` +
      `Copy .env.local.example and fill it in.`,
  );
}

export const supabaseUrl = () => need("NEXT_PUBLIC_SUPABASE_URL");

export const publishableKey = () =>
  need("NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

/** Server only. This key ignores Row Level Security, so it must never be
 *  imported into anything that ends up in the browser. */
export const secretKey = () =>
  need("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
