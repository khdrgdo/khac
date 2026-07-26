import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

let refreshBackoffUntil = 0;

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);

    if (url.includes("grant_type=refresh_token") && Date.now() < refreshBackoffUntil) {
      return new Response(JSON.stringify({ error: "rate_limited", message: "Backoff active" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

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

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "30", 10);
      const backoffMs = Math.min(retryAfter * 1000, 60000);
      refreshBackoffUntil = Date.now() + backoffMs;
    }

    return res;
  };
}

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = "Missing Supabase env vars: " + missing.join(", ") + ". Set them in .env";
    throw new Error(message);
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
