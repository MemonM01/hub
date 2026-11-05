import { createAdminClient } from '@/lib/supabase/admin'
import { OPEN_CORS, newClientId, oauthError, oauthJson, okRedirectUri } from '@/lib/oauth/core'

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS })
}

// RFC 7591 dynamic client registration. Registering gives no access: I still approve each client.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { redirect_uris?: unknown; client_name?: unknown } | null
  const uris = Array.isArray(body?.redirect_uris) ? body!.redirect_uris.filter((u): u is string => typeof u === 'string') : []
  if (!uris.length || uris.length > 10 || !uris.every(okRedirectUri)) {
    return oauthError('invalid_redirect_uri', 'Give one to ten https, localhost or app redirect URIs.')
  }
  const name = typeof body?.client_name === 'string' ? body.client_name.slice(0, 100) : null
  const clientId = newClientId()
  const { error } = await createAdminClient()
    .from('oauth_clients')
    .insert({ client_id: clientId, client_name: name, redirect_uris: uris })
  if (error) return oauthError('server_error', error.message, 500)
  return oauthJson(
    {
      client_id: clientId,
      client_name: name,
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    201,
  )
}
