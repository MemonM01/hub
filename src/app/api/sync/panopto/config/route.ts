import { verifySyncToken } from '@/lib/sync/auth'
import { json, preflight } from '@/lib/sync/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { panoptoState } from '@/lib/sync/panopto'

export function OPTIONS(request: Request) {
  return preflight(request)
}

// Start of a run: my module codes and the Panopto folders already known.
export async function POST(request: Request) {
  const userId = await verifySyncToken(request)
  if (!userId) return json(request, { error: 'Sync token missing or revoked. Make a new one in Settings.' }, 401)
  return json(request, await panoptoState(createAdminClient(), userId))
}
