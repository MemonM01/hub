import sharp from 'sharp'
import { verifySyncToken } from '@/lib/sync/auth'
import { json, preflight } from '@/lib/sync/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { putBytes } from '@/lib/r2'

const MAX = 3 * 1024 * 1024

export function OPTIONS(request: Request) {
  return preflight(request)
}

// One lecture preview image from the Panopto bookmarklet: raw bytes, ?session=<Panopto session id>.
export async function POST(request: Request) {
  const userId = await verifySyncToken(request)
  if (!userId) return json(request, { error: 'Sync token missing or revoked. Make a new one in Settings.' }, 401)

  const session = new URL(request.url).searchParams.get('session') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(session)) return json(request, { error: 'Bad session id.' }, 400)
  if (!(request.headers.get('content-type') ?? '').startsWith('image/')) return json(request, { error: 'Not an image.' }, 400)

  const bytes = new Uint8Array(await request.arrayBuffer())
  if (!bytes.length || bytes.length > MAX) return json(request, { error: 'Image empty or too big.' }, 400)

  const admin = createAdminClient()
  const { data: lecture } = await admin
    .from('lectures')
    .select('id')
    .eq('user_id', userId)
    .eq('panopto_session_id', session)
    .maybeSingle()
  if (!lecture) return json(request, { error: 'No such lecture.' }, 404)

  try {
    const webp = await sharp(bytes).resize(640, 360, { fit: 'cover' }).webp({ quality: 72 }).toBuffer()
    const key = `u/${userId}/lectures/${lecture.id}.webp`
    await putBytes(key, new Uint8Array(webp), 'image/webp')
    await admin.from('lectures').update({ thumbnail_key: key }).eq('id', lecture.id).eq('user_id', userId)
    return json(request, { ok: true })
  } catch (e) {
    return json(request, { error: (e as Error).message }, 500)
  }
}
