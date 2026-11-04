import Link from 'next/link'
import type { Metadata } from 'next'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getModules } from '@/lib/data'
import { parseModuleCode } from '@/lib/sheets'
import { formatDate } from '@/lib/format'
import { ArchiveFolderButton, FolderMatch, WatchedToggle } from '@/components/lecture-controls'

export const instant = false
export const metadata: Metadata = { title: 'Lectures' }

type Folder = { id: string; name: string; module_id: string | null; archived: boolean }
type Lecture = {
  id: string
  title: string
  module_id: string | null
  folder_id: string | null
  delivered_at: string | null
  duration_seconds: number | null
  transcript: string | null
  lecture_progress: { watched: boolean; percent: number } | null
}

function minutes(s: number | null) {
  return s ? `${Math.round(s / 60)} min` : ''
}

export default async function LecturesPage() {
  await requireUserId()
  const supabase = await createClient()
  const [modules, foldersRes, lecturesRes] = await Promise.all([
    getModules(),
    supabase.from('panopto_folders').select('id, name, module_id, archived').order('name'),
    supabase
      .from('lectures')
      .select('id, title, module_id, folder_id, delivered_at, duration_seconds, transcript, lecture_progress(watched, percent)')
      .order('delivered_at', { ascending: false }),
  ])
  const folders = (foldersRes.data ?? []) as Folder[]
  const lectures = (lecturesRes.data ?? []) as unknown as Lecture[]
  const archivedFolder = new Set(folders.filter((f) => f.archived).map((f) => f.id))
  const visible = lectures.filter((l) => !l.folder_id || !archivedFolder.has(l.folder_id))
  const unmatched = folders.filter((f) => !f.module_id && !f.archived)
  const countIn = (folderId: string) => lectures.filter((l) => l.folder_id === folderId).length

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lectures</h1>
        <p className="mt-1 text-sm text-muted">
          Lectures arrive when you click the Panopto bookmarklet (install it in{' '}
          <Link href="/settings" prefetch={false} className="underline">
            Settings
          </Link>
          ).
        </p>
      </div>

      {unmatched.length ? (
        <div className="rounded-lg border border-accent p-4">
          <h2 className="text-sm font-medium">Match these Panopto folders to a module</h2>
          <p className="mt-0.5 text-xs text-muted">You only do this once. Later syncs file new recordings automatically.</p>
          <ul className="mt-3 space-y-2">
            {unmatched.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted">{countIn(f.id)} recording(s)</span>
                <FolderMatch folderId={f.id} moduleId={null} modules={modules} suggested={parseModuleCode(f.name)} />
                <ArchiveFolderButton folderId={f.id} archived={false} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {modules.map((m) => {
        const rows = visible.filter((l) => l.module_id === m.id)
        if (!rows.length) return null
        const watched = rows.filter((l) => l.lecture_progress?.watched).length
        return (
          <div key={m.id}>
            <h2 className="mb-2 flex items-baseline gap-2">
              <Link href={`/modules/${m.code}/videos`} prefetch={false} className="font-mono font-medium hover:underline">
                {m.code}
              </Link>
              <span className="text-xs text-muted">
                {watched}/{rows.length} watched
              </span>
            </h2>
            <LectureList rows={rows} />
          </div>
        )
      })}

      {visible.some((l) => !l.module_id) ? (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted">Not filed yet</h2>
          <LectureList rows={visible.filter((l) => !l.module_id)} />
        </div>
      ) : null}

      {!lectures.length ? <p className="text-sm text-muted">No lectures yet.</p> : null}

      {folders.length ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted">Panopto folders ({folders.length})</summary>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {folders.map((f) => (
              <li key={f.id} className={`flex flex-wrap items-center gap-3 px-4 py-2 text-sm ${f.archived ? 'opacity-60' : ''}`}>
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <FolderMatch folderId={f.id} moduleId={f.module_id} modules={modules} />
                <ArchiveFolderButton folderId={f.id} archived={f.archived} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}

function LectureList({ rows }: { rows: Lecture[] }) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {rows.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
          <Link href={`/lectures/${l.id}`} prefetch={false} className="min-w-0 flex-1 truncate hover:underline">
            {l.title}
          </Link>
          <span className="text-xs text-muted">{formatDate(l.delivered_at)}</span>
          <span className="hidden w-14 text-right text-xs text-muted sm:inline">{minutes(l.duration_seconds)}</span>
          {l.transcript ? <span className="hidden text-[10px] uppercase tracking-wide text-muted sm:inline">Transcript</span> : null}
          <WatchedToggle lectureId={l.id} watched={!!l.lecture_progress?.watched} />
        </li>
      ))}
    </ul>
  )
}
