import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | undefined;

/**
 * Service-role client: bypasses RLS. Only ever used on the server, after our
 * own authz checks, for Storage, Realtime broadcasts and Auth admin calls.
 */
export function supabaseAdmin(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
