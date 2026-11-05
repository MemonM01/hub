import { verifySyncToken } from '@/lib/sync/auth'
import { json, preflight } from '@/lib/sync/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { RELAY_MAX_BYTES, minervaState } from '@/lib/sync/minerva'

export function OPTIONS(request: Request) {
  return preflight(request)
}

export async function POST(request: Request) {
  const userId = await verifySyncToken(request)
  if (!userId) return json(request, { error: 'Sync token missing or revoked. Make a new one in Settings.' }, 401)
  return json(request, { ...(await minervaState(createAdminClient(), userId)), relayMaxBytes: RELAY_MAX_BYTES })
}
