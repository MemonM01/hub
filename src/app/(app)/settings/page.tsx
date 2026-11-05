import type { Metadata } from 'next'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { appOrigin } from '@/lib/origin'
import { formatDateTime } from '@/lib/format'
import { BookmarkletInstaller } from '@/components/bookmarklets'
import { RevokeButton } from '@/components/revoke-button'

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
  const active = tokens.filter((t) => !t.revoked_at)
  const revoked = tokens.filter((t) => t.revoked_at)

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Bookmarklets</h2>
        <p className="max-w-prose text-sm text-muted">
          The bookmarklets read Panopto and Minerva from your own logged-in browser and send what they find here with a
          sync token. Your university password never touches this app.
        </p>
        <BookmarkletInstaller origin={origin} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">hub extension (Chrome)</h2>
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Sync tokens</h2>
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
