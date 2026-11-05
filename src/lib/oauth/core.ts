import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { newToken, sha256 } from '@/lib/tokens'

export const ACCESS_TTL_S = 60 * 60 // 1 hour
export const REFRESH_TTL_S = 60 * 60 * 24 * 30 // 30 days
export const CODE_TTL_S = 60 * 10
export const SCOPE = 'hub:read hub:learning'

export function issuer(request: Request) {
  const u = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? u.host
  const proto = request.headers.get('x-forwarded-proto') ?? u.protocol.replace(':', '')
  return `${proto}://${host}`
}

// OAuth endpoints are called from other origins (MCP clients), and carry no cookies.
export const OPEN_CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
  'access-control-expose-headers': 'www-authenticate, mcp-session-id',
}

export function oauthJson(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...OPEN_CORS, 'cache-control': 'no-store', ...extra } })
}

export function oauthError(error: string, description: string, status = 400) {
  return oauthJson({ error, error_description: description }, status)
}

export function s256(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function okRedirectUri(uri: string) {
  try {
    const u = new URL(uri)
    if (u.hash) return false
    if (u.protocol === 'https:') return true
    if (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return true
    // Native apps (Cursor, Claude desktop) register custom schemes like cursor:// or claude://
    return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !['javascript:', 'data:', 'file:', 'http:', 'vbscript:'].includes(u.protocol)
  } catch {
    return false
  }
}

export function newClientId() {
  return 'hub_client_' + randomBytes(16).toString('base64url')
}

/** Issue an access and refresh token pair. Only hashes are stored. */
export async function issueTokens(userId: string, clientId: string, scope: string) {
  const access = newToken('mcp')
  const refresh = newToken('refresh')
  const now = Date.now()
  const { error } = await createAdminClient()
    .from('oauth_tokens')
    .insert({
      user_id: userId,
      client_id: clientId,
      prefix: access.prefix,
      access_hash: access.hash,
      refresh_hash: refresh.hash,
      scope,
      access_expires_at: new Date(now + ACCESS_TTL_S * 1000).toISOString(),
      refresh_expires_at: new Date(now + REFRESH_TTL_S * 1000).toISOString(),
    })
  if (error) throw new Error(error.message)
  return {
    access_token: access.token,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_S,
    refresh_token: refresh.token,
    scope,
  }
}

/** The user behind an MCP bearer token, or null. */
export async function verifyAccessToken(request: Request): Promise<{ userId: string; clientId: string } | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token.startsWith('hub_mcp_')) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('oauth_tokens')
    .select('id, user_id, client_id, access_expires_at, revoked_at')
    .eq('access_hash', sha256(token))
    .maybeSingle()
  if (!data || data.revoked_at || new Date(data.access_expires_at).getTime() < Date.now()) return null
  await admin.from('oauth_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return { userId: data.user_id, clientId: data.client_id }
}
