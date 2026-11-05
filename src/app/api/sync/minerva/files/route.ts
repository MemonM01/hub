import { revalidatePath } from 'next/cache'
import { verifySyncToken } from '@/lib/sync/auth'
import { json, preflight } from '@/lib/sync/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanFiles, saveMinerva } from '@/lib/sync/minerva'

export function OPTIONS(request: Request) {
  return preflight(request)
}

export async function POST(request: Request) {
  const userId = await verifySyncToken(request)
  if (!userId) return json(request, { error: 'Sync token missing or revoked. Make a new one in Settings.' }, 401)
  let body: { files?: unknown }
  try {
    body = await request.json()
  } catch {
    return json(request, { error: 'Body was not JSON.' }, 400)
  }
  try {
    const result = await saveMinerva(createAdminClient(), userId, cleanFiles(body.files))
    revalidatePath('/files')
    revalidatePath('/assignments')
    return json(request, result)
  } catch (e) {
    return json(request, { error: (e as Error).message }, 500)
  }
}
