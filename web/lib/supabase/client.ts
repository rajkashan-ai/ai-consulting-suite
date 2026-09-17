"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publishableKey, supabaseUrl } from "./env";

/**
 * The browser's client. It holds the publishable key, which is meant to be
 * public: everything it can reach is limited by Row Level Security, so a key in
 * someone's devtools gives them their own rows and nothing else.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), publishableKey());
}
