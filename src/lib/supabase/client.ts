import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://wvvjbcagjcgnvzuqrulh.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dmpiY2FnamNnbnZ6dXFydWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTY1MDMsImV4cCI6MjA5OTg5MjUwM30.in9sj1r2vCd_TBoqLOsgN-D2WJ-reuQLdnmFX4y3rSw";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
