import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { secretKey, supabaseUrl } from "./env";

/**
 * The client that ignores Row Level Security.
 *
 * Use it for exactly two things: reading the allowlist, which no signed-in user
 * is allowed to see, and reading the blocked-domain list before we fetch a page.
 * Anything to do with a customer's own data goes through the ordinary client,
 * so the database keeps deciding what they can reach.
 *
 * `server-only` at the top makes importing this from a client component a build
 * error rather than a leaked key.
 */
export function createAdminClient() {
  return createSupabaseClient(supabaseUrl(), secretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
