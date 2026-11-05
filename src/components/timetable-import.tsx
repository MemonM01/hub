'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { importTimetableFile, syncTimetableFromLink, type ImportState } from '@/lib/actions/timetable'

export function TimetableImport({ hasLink, compact }: { hasLink: boolean; compact?: boolean }) {
  const router = useRouter()
  const [state, action, uploading] = useActionState<ImportState, FormData>(importTimetableFile, {})
  const [linkState, setLinkState] = useState<ImportState>({})
  const [syncing, start] = useTransition()
  const shown = linkState.ok || linkState.error ? linkState : state

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-3' : 'space-y-3 rounded-lg border border-line p-4'}>
      {!compact ? (
        <p className="text-sm">
          Your calendar is empty until you import your own MyTimetable export. Nothing is made up.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {hasLink ? (
          <button
            type="button"
            disabled={syncing}
            className="btn-primary"
            onClick={() =>
              start(async () => {
                setLinkState(await syncTimetableFromLink())
                router.refresh()
              })
            }
          >
            {syncing ? 'Syncing…' : 'Sync timetable'}
          </button>
        ) : null}
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input name="file" type="file" accept=".ics,text/calendar" className="max-w-56 text-xs" />
          <button type="submit" disabled={uploading} className="rounded-md border border-line px-3 py-1.5 text-sm">
            {uploading ? 'Importing…' : 'Import .ics'}
          </button>
        </form>
      </div>
      {shown.error ? <p className="text-sm text-danger">{shown.error}</p> : null}
      {shown.ok ? <p className="text-sm text-muted">{shown.ok}</p> : null}
      {!hasLink && !compact ? (
        <p className="text-xs text-muted">
          To sync without downloading a file, add your MyTimetable link as <code className="font-mono">TIMETABLE_ICS_URL</code> in
          Vercel.
        </p>
      ) : null}
    </div>
  )
}
