// Throwaway Supabase client used ONLY when an admin creates a new teacher
// account from the admin dashboard. supabase.auth.signUp() on the regular
// shared client would switch the current browser session to the newly
// created user, silently signing the admin out of their own session. This
// isolated client never persists a session and is discarded after use.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function isolatedFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

/** Creates a fresh, session-isolated Supabase client. Use once, then discard. */
export function createIsolatedSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment variables for isolated client.");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: isolatedFetch(SUPABASE_PUBLISHABLE_KEY) },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
