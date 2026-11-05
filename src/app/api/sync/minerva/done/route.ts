import { verifySyncToken } from '@/lib/sync/auth'
import { json, preflight } from '@/lib/sync/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { confirmBytes } from '@/lib/sync/finish'

export function OPTIONS(request: Request) {
  return preflight(request)
}

// After a browser PUT to R2 worked: check the bytes and record the size.
export async function POST(request: Request) {
  const userId = await verifySyncToken(request)
  if (!userId) return json(request, { error: 'Sync token missing or revoked.' }, 401)
  const { fileId } = (await request.json().catch(() => ({}))) as { fileId?: string }
  if (!fileId) return json(request, { error: 'fileId missing' }, 400)
  const res = await confirmBytes(createAdminClient(), userId, fileId)
  return json(request, res, res.ok ? 200 : 400)
}
