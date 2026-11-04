import Link from 'next/link'
import { requireUserId } from '@/lib/auth'
import { getModuleBundle } from '@/lib/module-data'
import { progressFor } from '@/lib/data'
import { FOLDERS, type FolderKey } from '@/lib/types'
import { ProgressBar } from '@/components/progress-bar'
import { ArchiveButton } from '@/components/archive-button'

export const instant = false

export default async function ModulePage({ params }: PageProps<'/modules/[code]'>) {
  await requireUserId()
  const { code } = await params
  const { module: mod, files, lectures, assignments } = await getModuleBundle(code)
  const progress = progressFor(mod.id, assignments)

  const counts: Record<FolderKey, number> = {
    videos: lectures.length,
    slides: files.filter((f) => (FOLDERS.slides.kinds as readonly string[]).includes(f.kind ?? '')).length,
    worksheets: files.filter((f) => (FOLDERS.worksheets.kinds as readonly string[]).includes(f.kind ?? '')).length,
    assignments: assignments.filter((a) => a.status !== 'cancelled').length,
    topics: new Set(files.map((f) => f.week).filter((w) => w != null)).size,
    other: files.filter((f) => !f.kind || (FOLDERS.other.kinds as readonly string[]).includes(f.kind)).length,
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href="/modules" prefetch={false} className="text-sm text-muted hover:text-ink">
            ← Modules
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight">{mod.code}</h1>
          {mod.name ? <p className="text-sm text-muted">{mod.name}</p> : null}
        </div>
        <ArchiveButton moduleId={mod.id} archived={mod.archived} />
      </div>
      <div className="max-w-sm">
        <ProgressBar done={progress.done} total={progress.total} />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(Object.keys(FOLDERS) as FolderKey[]).map((key) => (
          <li key={key}>
            <Link
              href={`/modules/${mod.code}/${key}`}
              prefetch={false}
              className="flex items-center gap-3 rounded-lg border border-line p-4 hover:border-accent"
            >
              <FolderIcon />
              <span className="flex-1 text-sm font-medium">{FOLDERS[key].label}</span>
              <span className="text-xs tabular-nums text-muted">{counts[key]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 text-accent" aria-hidden="true">
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h4l2 2h7A1.5 1.5 0 0 1 18 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5z" fill="currentColor" opacity=".85" />
    </svg>
  )
}
