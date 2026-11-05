import { createAdminClient } from '@/lib/supabase/admin'
import { sha256 } from '@/lib/tokens'
import { OPEN_CORS } from '@/lib/oauth/core'

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS })
}

// RFC 7009. Always 200, whether or not the token existed.
export async function POST(request: Request) {
  const p = new URLSearchParams(await request.text())
  const token = p.get('token') ?? ''
  if (token) {
    const h = sha256(token)
    const admin = createAdminClient()
    const now = new Date().toISOString()
    await admin.from('oauth_tokens').update({ revoked_at: now }).eq('access_hash', h)
    await admin.from('oauth_tokens').update({ revoked_at: now }).eq('refresh_hash', h)
  }
  return new Response(null, { status: 200, headers: OPEN_CORS })
}
