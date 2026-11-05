'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { newToken } from '@/lib/tokens'
import { CODE_TTL_S, SCOPE } from '@/lib/oauth/core'

function back(uri: string, params: Record<string, string | null>) {
  const u = new URL(uri)
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v)
  return u.toString()
}

/** I press Allow or Deny on the consent page. */
export async function decide(formData: FormData) {
  const userId = await requireUserId()
  const clientId = String(formData.get('client_id') ?? '')
  const redirectUri = String(formData.get('redirect_uri') ?? '')
  const state = String(formData.get('state') ?? '') || null
  const challenge = String(formData.get('code_challenge') ?? '')
  const resource = String(formData.get('resource') ?? '') || null
  const allow = formData.get('decision') === 'allow'

  const admin = createAdminClient()
  const { data: client } = await admin.from('oauth_clients').select('client_id, user_id, redirect_uris').eq('client_id', clientId).maybeSingle()
  // Never redirect to a URI the client did not register.
  if (!client || !client.redirect_uris.includes(redirectUri)) throw new Error('Unknown client or redirect URI.')
  if (client.user_id && client.user_id !== userId) throw new Error('This client belongs to someone else.')

  if (!allow) redirect(back(redirectUri, { error: 'access_denied', state }))
  if (!challenge) redirect(back(redirectUri, { error: 'invalid_request', error_description: 'PKCE required', state }))

  if (!client.user_id) await admin.from('oauth_clients').update({ user_id: userId }).eq('client_id', clientId)
  const code = newToken('code')
  const { error } = await admin.from('oauth_codes').insert({
    code_hash: code.hash,
    user_id: userId,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    scope: SCOPE,
    resource,
    expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
  })
  if (error) throw new Error(error.message)
  redirect(back(redirectUri, { code: code.token, state }))
}

/** Settings: disconnect an app. Revokes all of its tokens. */
export async function revokeClient(clientId: string) {
  await requireUserId()
  const supabase = await createClient()
  const { error } = await supabase.from('oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('client_id', clientId).is('revoked_at', null)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}
