import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let serverClient = null;

export function isSupabaseServerConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseServer() {
  if (!isSupabaseServerConfigured()) return null;
  if (!serverClient) {
    serverClient = createClient(supabaseUrl, supabaseAnonKey, {
      // No session storage on the server: the browser client keeps the session in
      // localStorage, so server components always read anonymously. Row Level
      // Security still applies, which is why these helpers are read-only.
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serverClient;
}