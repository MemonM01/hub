import Link from 'next/link'
import type { Metadata } from 'next'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getModules } from '@/lib/data'
import { parseModuleCode } from '@/lib/sheets'
import { ArchiveFolderButton, FolderMatch } from '@/components/lecture-controls'
import { LectureTile, TileGrid, type TileLecture } from '@/components/lecture-tile'
import { moduleColors } from '@/lib/module-color'
import { ModuleTag } from '@/components/module-tag'

export const instant = false
export const metadata: Metadata = { title: 'Lectures' }

type Folder = { id: string; name: string; module_id: string | null; archived: boolean }
type Lecture = TileLecture & { module_id: string | null; folder_id: string | null }

const PER_MODULE = 8

export default async function LecturesPage() {
  await requireUserId()
  const supabase = await createClient()
  const [modules, foldersRes, lecturesRes] = await Promise.all([
    getModules(),
    supabase.from('panopto_folders').select('id, name, module_id, archived').order('name'),
    supabase
      .from('lectures')
      .select('id, title, module_id, folder_id, delivered_at, duration_seconds, thumbnail_key, lecture_progress(watched, percent)')
      .order('delivered_at', { ascending: false }),
  ])
  const folders = (foldersRes.data ?? []) as Folder[]
  const lectures = (lecturesRes.data ?? []) as unknown as Lecture[]
  const archivedFolder = new Set(folders.filter((f) => f.archived).map((f) => f.id))
  const visible = lectures.filter((l) => !l.folder_id || !archivedFolder.has(l.folder_id))
  const unmatched = folders.filter((f) => !f.module_id && !f.archived)
  const color = moduleColors(modules.map((m) => m.code))
  const countIn = (folderId: string) => lectures.filter((l) => l.folder_id === folderId).length
  const codeOf = new Map(modules.map((m) => [m.id, m.code]))
  const filed = visible.filter((l) => l.module_id && codeOf.has(l.module_id))
  const behind = filed.filter((l) => !l.lecture_progress?.watched)

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Lectures</h1>
        {filed.length ? (
          <p className="mt-1 text-sm text-muted">
            {behind.length ? `${behind.length} not watched yet, newest first.` : 'All caught up.'} Click one to watch it with its transcript.
          </p>
        ) : null}
      </header>

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

      {behind.length ? (
        <div>
          <h2 className="mb-3 text-base font-semibold">Catch up</h2>
          <TileGrid>
            {behind.slice(0, 8).map((l) => {
              const code = codeOf.get(l.module_id!)!
              return (
                <li key={l.id}>
                  <LectureTile l={l} code={code} color={color.get(code)} from="/lectures" />
                </li>
              )
            })}
          </TileGrid>
        </div>
      ) : null}

      {modules.map((m) => {
        const rows = visible.filter((l) => l.module_id === m.id)
        if (!rows.length) return null
        const watched = rows.filter((l) => l.lecture_progress?.watched).length
        return (
          <div key={m.id}>
            <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3">
              <ModuleTag code={m.code} color={color.get(m.code)} className="text-base" />
              <span className="text-sm text-muted">{m.name}</span>
              <span className="ml-auto text-sm tabular-nums text-muted">
                {watched} of {rows.length} watched
              </span>
            </h2>
            <TileGrid>
              {rows.slice(0, PER_MODULE).map((l) => (
                <li key={l.id}>
                  <LectureTile l={l} color={color.get(m.code)} from="/lectures" />
                </li>
              ))}
            </TileGrid>
            {rows.length > PER_MODULE ? (
              <Link href={`/modules/${m.code}/videos`} prefetch={false} className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                All {rows.length} {m.code} recordings →
              </Link>
            ) : null}
          </div>
        )
      })}

      {visible.some((l) => !l.module_id) ? (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted">Not filed yet</h2>
          <TileGrid>
            {visible
              .filter((l) => !l.module_id)
              .map((l) => (
                <li key={l.id}>
                  <LectureTile l={l} from="/lectures" />
                </li>
              ))}
          </TileGrid>
        </div>
      ) : null}

      {!lectures.length ? (
        <p className="rounded-xl border border-dashed border-line px-5 py-8 text-sm text-muted">
          No lectures yet. Open Panopto, log in, and click the hub · Panopto bookmark (make it in{' '}
          <Link href="/settings" prefetch={false} className="underline">
            Settings
          </Link>
          ).
        </p>
      ) : null}

      {folders.length ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted">Panopto folders ({folders.length})</summary>
          <ul className="mt-2 divide-y divide-line rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
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
