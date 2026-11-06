import Link from 'next/link'
import type { Metadata } from 'next'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { appOrigin } from '@/lib/origin'
import { formatDateTime } from '@/lib/format'
import { BookmarkletInstaller } from '@/components/bookmarklets'
import { RevokeButton } from '@/components/revoke-button'
import { DisconnectButton } from '@/components/disconnect-button'

export const instant = false
export const metadata: Metadata = { title: 'Settings' }

type Token = {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export default async function SettingsPage() {
  await requireUserId()
  const supabase = await createClient()
  const [origin, { data }] = await Promise.all([
    appOrigin(),
    supabase
      .from('sync_tokens')
      .select('id, name, prefix, created_at, last_used_at, revoked_at')
      .order('created_at', { ascending: false }),
  ])
  const tokens = (data ?? []) as Token[]
  const [{ data: clients }, { data: oauthTokens }] = await Promise.all([
    supabase.from('oauth_clients').select('client_id, client_name, created_at'),
    supabase.from('oauth_tokens').select('client_id, prefix, last_used_at, revoked_at, refresh_expires_at, created_at').order('created_at', { ascending: false }),
  ])
  const apps = (clients ?? [])
    .map((c) => {
      const live = (oauthTokens ?? []).filter((t) => t.client_id === c.client_id && !t.revoked_at)
      const lastUsed = (oauthTokens ?? []).filter((t) => t.client_id === c.client_id).map((t) => t.last_used_at).filter(Boolean).sort().pop() ?? null
      return { ...c, live: live.length, prefix: live[0]?.prefix ?? null, lastUsed }
    })
    .filter((a) => a.live > 0)
  const active = tokens.filter((t) => !t.revoked_at)
  const revoked = tokens.filter((t) => t.revoked_at)

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Weekly routine</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {[
            ['New lectures', 'Open Panopto, log in, then click the hub · Panopto bookmark.'],
            ['New Minerva files', 'Open Minerva in Chrome, click the hub sync extension, then Sync Minerva now.'],
            ['Timetable changes', 'Open Calendar and click Sync timetable.'],
            ['Questions about your work', 'Ask Claude. It reads hub through the hub connector.'],
          ].map(([what, how]) => (
            <li key={what} className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
              <div className="font-medium">{what}</div>
              <p className="mt-1 text-sm text-muted">{how}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted">
          Anything the sorter was unsure about waits under{' '}
          <Link href="/files" prefetch={false} className="underline">
            Files
          </Link>{' '}
          as needing a look.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Bookmarklets</h2>
        <p className="max-w-prose text-sm text-muted">
          The bookmarklets read Panopto and Minerva from your own logged-in browser and send what they find here with a
          sync token. Your university password never touches this app.
        </p>
        <BookmarkletInstaller origin={origin} />
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">hub extension (Chrome)</h2>
        <p className="max-w-prose text-sm text-muted">
          Minerva serves files from a separate server that a bookmarklet is not allowed to read. The extension can, so it
          copies the files too. Install it once:
        </p>
        <ol className="max-w-prose list-decimal space-y-1 pl-5 text-sm">
          <li>
            In Chrome, open <code className="font-mono text-xs">chrome://extensions</code> and turn on Developer mode.
          </li>
          <li>
            Click Load unpacked and choose the <code className="font-mono text-xs">extension</code> folder inside Betterva.
          </li>
          <li>Pin hub sync, click it, and paste the hub address ({origin}) and a sync token from above.</li>
          <li>Log in to Minerva in Chrome, then click hub sync and Sync Minerva now.</li>
        </ol>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Assistant connector (MCP)</h2>
        <p className="max-w-prose text-sm text-muted">
          Add <code className="font-mono text-xs">{origin}/mcp</code> as a custom connector in Claude or Cursor. You approve it here,
          and it can read your data and update only the learning profile.
        </p>
        {apps.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {apps.map((a) => (
              <li key={a.client_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-medium">{a.client_name ?? 'App'}</span>
                {a.prefix ? <code className="font-mono text-xs text-muted">{a.prefix}…</code> : null}
                <span className="text-xs text-muted">{a.lastUsed ? `Last used ${formatDateTime(a.lastUsed)}` : 'Not used yet'}</span>
                <span className="ml-auto">
                  <DisconnectButton clientId={a.client_id} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No apps connected.</p>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Sync tokens</h2>
        {active.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {active.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-medium">{t.name}</span>
                <code className="font-mono text-xs text-muted">{t.prefix}…</code>
                <span className="text-xs text-muted">Made {formatDateTime(t.created_at)}</span>
                <span className="text-xs text-muted">
                  {t.last_used_at ? `Last used ${formatDateTime(t.last_used_at)}` : 'Never used'}
                </span>
                <span className="ml-auto">
                  <RevokeButton id={t.id} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No active tokens.</p>
        )}
        {revoked.length ? (
          <p className="text-xs text-muted">{revoked.length} revoked token(s) hidden.</p>
        ) : null}
      </div>
    </section>
  )
}
