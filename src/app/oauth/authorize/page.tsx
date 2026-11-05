import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getUserId } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Mark } from '@/components/mark'
import { decide } from '@/lib/actions/oauth'

export const instant = false
export const metadata: Metadata = { title: 'Connect an app' }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function AuthorizePage({ searchParams }: PageProps<'/oauth/authorize'>) {
  const sp = await searchParams
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [])))
  // Signed-in page: send me to log in first, then back here.
  if (!(await getUserId())) redirect(`/login?next=${encodeURIComponent('/oauth/authorize?' + qs.toString())}`)

  const clientId = one(sp.client_id)
  const redirectUri = one(sp.redirect_uri)
  const problem = (msg: string) => (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold">Cannot connect</h1>
      <p className="mt-2 text-sm text-muted">{msg}</p>
    </main>
  )
  const { data: client } = await createAdminClient()
    .from('oauth_clients')
    .select('client_id, client_name, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle()
  if (!client) return problem('This app is not registered with hub.')
  if (!client.redirect_uris.includes(redirectUri)) return problem('The redirect address does not match what the app registered.')
  if (one(sp.response_type) !== 'code') return problem('Only the authorization code flow is supported.')
  if (one(sp.code_challenge_method) !== 'S256' || !one(sp.code_challenge)) return problem('The app must use PKCE (S256).')

  const name = client.client_name || 'An app'
  let where = redirectUri
  try {
    where = new URL(redirectUri).host || redirectUri
  } catch {}

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="mb-6 flex items-center gap-2">
        <Mark className="h-7 w-7" />
        <span className="font-semibold">hub</span>
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Connect {name}?</h1>
      <p className="mt-2 text-sm text-muted">It will connect as you and come back to {where}.</p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
        <li>Read your modules, assignments, lectures, files and timetable</li>
        <li>Read and update your learning profile (each change is logged in Activity and can be undone)</li>
      </ul>
      <p className="mt-3 text-sm text-muted">It cannot change anything else. You can disconnect it in Settings.</p>
      <form action={decide} className="mt-6 flex gap-2">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="state" value={one(sp.state)} />
        <input type="hidden" name="code_challenge" value={one(sp.code_challenge)} />
        <input type="hidden" name="resource" value={one(sp.resource)} />
        <button name="decision" value="allow" className="btn-primary">
          Allow
        </button>
        <button name="decision" value="deny" className="rounded-md border border-line px-3 py-2 text-sm">
          Deny
        </button>
      </form>
    </main>
  )
}
