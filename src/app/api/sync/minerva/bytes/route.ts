import { revalidatePath } from 'next/cache'
import { verifySyncToken } from '@/lib/sync/auth'
import { json, preflight } from '@/lib/sync/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { putBytes } from '@/lib/r2'
import { RELAY_MAX_BYTES } from '@/lib/sync/minerva'
import { confirmBytes } from '@/lib/sync/finish'

export function OPTIONS(request: Request) {
  return preflight(request)
}

// The browser cannot PUT from the Minerva origin into R2 (CORS is my own origins only).
// For small files the bookmarklet sends the bytes here instead, and the server stores them.
export async function POST(request: Request) {
  const userId = await verifySyncToken(request)
  if (!userId) return json(request, { error: 'Sync token missing or revoked.' }, 401)
  const fileId = new URL(request.url).searchParams.get('fileId')
  if (!fileId) return json(request, { error: 'fileId missing' }, 400)
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > RELAY_MAX_BYTES) return json(request, { error: 'Too large to relay' }, 413)

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('files')
    .select('id, r2_key, mime_type, size_bytes')
    .eq('id', fileId)
    .eq('user_id', userId)
    .eq('source', 'minerva')
    .maybeSingle()
  if (!row?.r2_key) return json(request, { error: 'File not found.' }, 404)
  if (row.size_bytes != null) return json(request, { ok: true, already: true })

  const bytes = new Uint8Array(await request.arrayBuffer())
  if (!bytes.length) return json(request, { error: 'Empty body' }, 400)
  if (bytes.length > RELAY_MAX_BYTES) return json(request, { error: 'Too large to relay' }, 413)
  // Never store an HTML login page as if it were the file.
  const head = new TextDecoder().decode(bytes.slice(0, 200)).trimStart().toLowerCase()
  const isHtmlFile = /html/.test(row.mime_type ?? '')
  if (!isHtmlFile && (head.startsWith('<!doctype html') || head.startsWith('<html'))) {
    return json(request, { error: 'Minerva sent a web page, not the file.' }, 422)
  }

  await putBytes(row.r2_key, bytes, row.mime_type ?? 'application/octet-stream')
  const res = await confirmBytes(admin, userId, fileId)
  revalidatePath('/files')
  return json(request, res, res.ok ? 200 : 500)
}
