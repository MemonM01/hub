import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

// Service-role client. Bypasses RLS.
// Use ONLY on the server, ONLY after a bookmarklet or OAuth token has been checked,
// and ALWAYS set user_id explicitly on every query and insert.
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
