import { createClient } from "@supabase/supabase-js";
import { config, requireEnv } from "../config/env";

export function createAdminClient() {
  return createClient(String(requireEnv("supabaseUrl")), String(requireEnv("supabaseServiceRoleKey")), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(token: string) {
  return createClient(String(requireEnv("supabaseUrl")), String(requireEnv("supabasePublishableKey")), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    apikey: config.supabasePublishableKey,
  };
}

export type SupabaseAdmin = ReturnType<typeof createAdminClient>;