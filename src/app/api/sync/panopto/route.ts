import { revalidatePath } from 'next/cache'
import { verifySyncToken } from '@/lib/sync/auth'
import { json, preflight } from '@/lib/sync/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanFolders, cleanSessions, panoptoState, savePanopto } from '@/lib/sync/panopto'

export function OPTIONS(request: Request) {
  return preflight(request)
}

// One batch of folders and sessions from the Panopto bookmarklet.
export async function POST(request: Request) {
  const userId = await verifySyncToken(request)
  if (!userId) return json(request, { error: 'Sync token missing or revoked. Make a new one in Settings.' }, 401)

  let body: { folders?: unknown; sessions?: unknown }
  try {
    body = await request.json()
  } catch {
    return json(request, { error: 'Body was not JSON.' }, 400)
  }

  const admin = createAdminClient()
  try {
    const result = await savePanopto(admin, userId, cleanFolders(body.folders), cleanSessions(body.sessions))
    revalidatePath('/lectures')
    revalidatePath('/')
    // Return current codes and known folders so the next run can target them.
    return json(request, { ...result, ...(await panoptoState(admin, userId)) })
  } catch (e) {
    return json(request, { error: (e as Error).message }, 500)
  }
}
