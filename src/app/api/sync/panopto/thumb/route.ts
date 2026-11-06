import sharp from 'sharp'
import { verifySyncToken } from '@/lib/sync/auth'
import { json, preflight } from '@/lib/sync/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { putBytes } from '@/lib/r2'

const MAX = 3 * 1024 * 1024

export function OPTIONS(request: Request) {
  return preflight(request)
}

// Panopto's public image CDN. Only these hosts are fetched by the server.
const CDN = /^https:\/\/[a-z0-9]+\.cloudfront\.net\/sessions\//i

async function imageBytes(request: Request): Promise<Uint8Array | string> {
  const type = request.headers.get('content-type') ?? ''
  if (type.startsWith('image/')) return new Uint8Array(await request.arrayBuffer())
  if (!type.startsWith('application/json')) return 'Send an image or {"url"}.'
  const { url } = (await request.json().catch(() => ({}))) as { url?: string }
  if (!url || !CDN.test(url)) return 'That image address is not Panopto\'s.'
  const res = await fetch(url, { redirect: 'error' }).catch(() => null)
  if (!res?.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return 'Could not fetch that image.'
  return new Uint8Array(await res.arrayBuffer())
}

// One lecture preview image from the Panopto bookmarklet, ?session=<Panopto session id>.
// The body is the image itself, or {"url"} for an image on Panopto's public CDN.
export async function POST(request: Request) {
  const userId = await verifySyncToken(request)
  if (!userId) return json(request, { error: 'Sync token missing or revoked. Make a new one in Settings.' }, 401)

  const session = new URL(request.url).searchParams.get('session') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(session)) return json(request, { error: 'Bad session id.' }, 400)
  const bytes = await imageBytes(request)
  if (typeof bytes === 'string') return json(request, { error: bytes }, 400)
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
