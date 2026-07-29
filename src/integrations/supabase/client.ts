import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

// Deduplicate in-flight refresh token requests so multiple parallel
// getSession() calls don't each fire their own refresh and get 429'd.
let pendingRefresh: Promise<Response> | null = null;

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);

    // Deduplicate refresh_token requests — if one is in-flight, reuse it
    if (url.includes("grant_type=refresh_token")) {
      if (pendingRefresh) return pendingRefresh;
      const p = doFetch(input, init, supabaseKey).finally(() => {
        if (pendingRefresh === p) pendingRefresh = null;
      });
      pendingRefresh = p;
      return p;
    }

    return doFetch(input, init, supabaseKey);
  };
}

async function doFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  supabaseKey: string,
): Promise<Response> {
  const headers = new Headers(
    typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
  );
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  if (
    isNewSupabaseApiKey(supabaseKey) &&
    headers.get("Authorization") === "Bearer " + supabaseKey
  ) {
    headers.delete("Authorization");
  }
  headers.set("apikey", supabaseKey);

  const res = await fetch(input, { ...init, headers });

  return res;
}

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://placeholder-project.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "sb_publishable_placeholder_key";

  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    console.warn("Supabase env variables are not fully set in import.meta.env. Using fallback client settings.");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
