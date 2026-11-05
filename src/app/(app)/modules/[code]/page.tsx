import Link from 'next/link'
import { requireUserId } from '@/lib/auth'
import { getModuleBundle } from '@/lib/module-data'
import { getModules, progressFor } from '@/lib/data'
import { FOLDERS, type FolderKey } from '@/lib/types'
import { moduleColors } from '@/lib/module-color'
import { ArchiveButton } from '@/components/archive-button'
import { AddFromLink } from '@/components/add-from-link'

export const instant = false

const FOLDER_HINT: Record<FolderKey, string> = {
  videos: 'Panopto recordings',
  slides: 'Lecture slides and notes',
  worksheets: 'Sheets, templates, solutions, labs',
  assignments: 'Coursework and progress',
  topics: 'Everything, by topic',
  other: 'Handbooks, readings, the rest',
}

export default async function ModulePage({ params }: PageProps<'/modules/[code]'>) {
  await requireUserId()
  const { code } = await params
  const [{ module: mod, files, lectures, assignments }, all] = await Promise.all([getModuleBundle(code), getModules({ includeArchived: true })])
  const color = moduleColors(all.filter((m) => !m.archived).map((m) => m.code)).get(mod.code) ?? 'var(--muted)'
  const progress = progressFor(mod.id, assignments)
  const watched = lectures.filter((l) => l.lecture_progress?.watched).length
  const inKinds = (k: FolderKey) => files.filter((f) => (FOLDERS[k].kinds as readonly string[]).includes(f.kind ?? '')).length

  const counts: Record<FolderKey, number> = {
    videos: lectures.length,
    slides: inKinds('slides'),
    worksheets: inKinds('worksheets'),
    assignments: assignments.filter((a) => a.status !== 'cancelled').length,
    topics: new Set(files.map((f) => f.topic ?? (f.week != null ? `w${f.week}` : null)).filter(Boolean)).size,
    other: files.filter((f) => !f.kind || (FOLDERS.other.kinds as readonly string[]).includes(f.kind)).length,
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href="/modules" prefetch={false} className="text-sm text-muted hover:text-ink">
            ← Modules
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <span className="h-3 w-3 rounded-full" style={{ background: color }} aria-hidden="true" />
            {mod.code}
          </h1>
          {mod.name ? <p className="mt-1 text-muted">{mod.name}</p> : null}
          <p className="mt-3 text-sm">
            <span className="font-medium tabular-nums">
              {progress.done} of {progress.total}
            </span>{' '}
            <span className="text-muted">sheets done</span>
            <span className="mx-3 text-line">|</span>
            <span className="font-medium tabular-nums">
              {watched} of {lectures.length}
            </span>{' '}
            <span className="text-muted">lectures watched</span>
          </p>
        </div>
        <ArchiveButton moduleId={mod.id} archived={mod.archived} />
      </div>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {(Object.keys(FOLDERS) as FolderKey[]).map((key) => (
          <li key={key}>
            <Link
              href={`/modules/${mod.code}/${key}`}
              prefetch={false}
              className="flex h-full flex-col rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--ink)]"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{FOLDERS[key].label}</span>
                <span className="text-sm tabular-nums text-muted">{counts[key]}</span>
              </span>
              <span className="mt-1 text-xs text-muted">{FOLDER_HINT[key]}</span>
            </Link>
          </li>
        ))}
      </ul>

      <AddFromLink moduleId={mod.id} code={mod.code} topics={mod.topics ?? []} />
    </section>
  )
}
