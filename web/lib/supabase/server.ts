import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publishableKey, supabaseUrl } from "./env";

/**
 * The client for server components, route handlers and server actions. It acts
 * as the signed-in person, so Row Level Security still applies.
 */
export async function createClient() {
  const store = await cookies();

  return createServerClient(supabaseUrl(), publishableKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          // A server component cannot set a cookie. That is fine and expected:
          // middleware refreshes the session on every request, so the write
          // that matters has already happened there.
        }
      },
    },
  });
}
