import { createAdminClient } from '@/lib/supabase/admin'
import { sha256 } from '@/lib/tokens'
import { OPEN_CORS, issueTokens, oauthError, oauthJson, s256 } from '@/lib/oauth/core'

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS })
}

async function params(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const j = (await request.json().catch(() => ({}))) as Record<string, string>
    return new URLSearchParams(j)
  }
  return new URLSearchParams(await request.text())
}

export async function POST(request: Request) {
  const p = await params(request)
  const grant = p.get('grant_type')
  const clientId = p.get('client_id') ?? ''
  const admin = createAdminClient()

  if (grant === 'authorization_code') {
    const code = p.get('code') ?? ''
    const verifier = p.get('code_verifier') ?? ''
    const redirectUri = p.get('redirect_uri') ?? ''
    if (!code || !verifier) return oauthError('invalid_request', 'code and code_verifier are required.')
    const { data: row } = await admin.from('oauth_codes').select('*').eq('code_hash', sha256(code)).maybeSingle()
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return oauthError('invalid_grant', 'That code is unknown, used or expired.')
    }
    if ((clientId && row.client_id !== clientId) || row.redirect_uri !== redirectUri) {
      return oauthError('invalid_grant', 'Client or redirect URI does not match.')
    }
    if (s256(verifier) !== row.code_challenge) return oauthError('invalid_grant', 'PKCE check failed.')
    // One use only: mark it before issuing.
    const { data: claimed } = await admin
      .from('oauth_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('code_hash', row.code_hash)
      .is('used_at', null)
      .select('code_hash')
    if (!claimed?.length) return oauthError('invalid_grant', 'That code was already used.')
    return oauthJson(await issueTokens(row.user_id, row.client_id, row.scope ?? 'hub:read hub:learning'))
  }

  if (grant === 'refresh_token') {
    const refresh = p.get('refresh_token') ?? ''
    const { data: row } = await admin
      .from('oauth_tokens')
      .select('id, user_id, client_id, scope, refresh_expires_at, revoked_at')
      .eq('refresh_hash', sha256(refresh))
      .maybeSingle()
    if (!row || row.revoked_at || (row.refresh_expires_at && new Date(row.refresh_expires_at).getTime() < Date.now())) {
      return oauthError('invalid_grant', 'That refresh token is unknown, revoked or expired.')
    }
    if (clientId && clientId !== row.client_id) return oauthError('invalid_grant', 'Client does not match.')
    // Rotate: the old pair stops working.
    await admin.from('oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', row.id)
    return oauthJson(await issueTokens(row.user_id, row.client_id, row.scope ?? 'hub:read hub:learning'))
  }

  return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token.')
}
