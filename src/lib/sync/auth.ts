import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sha256 } from '@/lib/tokens'

/**
 * Checks a bookmarklet sync token. Returns the owner's user id, or null.
 * After this, the caller may use the service-role client, and must set user_id on every write.
 */
export async function verifySyncToken(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token.startsWith('hub_sync_')) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('sync_tokens')
    .select('id, user_id')
    .eq('token_hash', sha256(token))
    .is('revoked_at', null)
    .maybeSingle()
  if (!data) return null

  await admin.from('sync_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return data.user_id
}
