import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/auth'
import { getModuleBundle } from '@/lib/module-data'
import { FOLDERS, STATUS_LABEL, type FileRow, type FolderKey } from '@/lib/types'
import { compareSheets } from '@/lib/sheets'
import { formatBytes, formatDate } from '@/lib/format'
import { compareFiles, groupOf } from '@/lib/order'

export const instant = false

export default async function FolderPage({ params }: PageProps<'/modules/[code]/[folder]'>) {
  await requireUserId()
  const { code, folder } = await params
  if (!(folder in FOLDERS)) notFound()
  const key = folder as FolderKey
  const { module: mod, files, lectures, assignments } = await getModuleBundle(code)
  const here = `/modules/${mod.code}/${key}`

  const kinds = FOLDERS[key].kinds as readonly string[]
  const inFolder = (
    key === 'other'
      ? files.filter((f) => !f.kind || kinds.includes(f.kind))
      : files.filter((f) => kinds.includes(f.kind ?? ''))
  ).sort(compareFiles)

  return (
    <section className="space-y-4">
      <div>
        <Link href={`/modules/${mod.code}`} prefetch={false} className="text-sm text-muted hover:text-ink">
          ← {mod.code}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{FOLDERS[key].label}</h1>
      </div>

      {key === 'videos' ? (
        lectures.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {lectures.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <Link href={`/lectures/${l.id}`} prefetch={false} className="min-w-0 flex-1 truncate text-sm hover:underline">
                  {l.title}
                </Link>
                <span className="text-xs text-muted">{formatDate(l.delivered_at)}</span>
                {l.lecture_progress?.watched ? <span className="text-xs text-accent">Watched</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="No lectures yet. They arrive with the Panopto bookmarklet in step 4." />
        )
      ) : key === 'assignments' ? (
        <>
          {assignments.filter((a) => a.status !== 'cancelled').length ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {assignments
                .filter((a) => a.status !== 'cancelled')
                .sort((a, b) => compareSheets(a.sheet, b.sheet))
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-10 font-mono tabular-nums">{a.sheet}</span>
                    <span className="min-w-0 flex-1 truncate">{a.title ?? (a.is_quiz ? 'Quiz' : 'Worksheet')}</span>
                    <span className="text-xs text-muted">{STATUS_LABEL[a.status]}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <Empty text="No assignments for this module yet." />
          )}
          <FileList files={inFolder} back={here} />
        </>
      ) : key === 'topics' ? (
        <TopicList files={files} back={here} />
      ) : key === 'worksheets' && inFolder.length ? (
        <GroupedList files={inFolder} back={here} />
      ) : inFolder.length ? (
        <FileList files={inFolder} back={here} />
      ) : (
        <Empty text="Nothing here yet." />
      )}
    </section>
  )
}

function FileList({ files, back }: { files: FileRow[]; back: string }) {
  if (!files.length) return null
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <Link
            href={`/files/${f.id}?from=${encodeURIComponent(back)}`}
            prefetch={false}
            className="min-w-0 flex-1 truncate hover:underline"
          >
            {f.title ?? f.filename}
          </Link>
          <span className="text-xs text-muted">{f.size_bytes != null ? formatBytes(f.size_bytes) : ''}</span>
        </li>
      ))}
    </ul>
  )
}

function GroupedList({ files, back }: { files: (FileRow & { week: number | null })[]; back: string }) {
  const groups: { key: string; label: string; files: typeof files }[] = []
  for (const f of files) {
    const g = groupOf(f) ?? { key: 'other', label: 'Other' }
    const last = groups.find((x) => x.key === g.key)
    if (last) last.files.push(f)
    else groups.push({ key: g.key, label: g.label, files: [f] })
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <h2 className="mb-1.5 text-sm font-medium">{g.label}</h2>
          <FileList files={g.files} back={back} />
        </div>
      ))}
    </div>
  )
}

function TopicList({ files, back }: { files: (FileRow & { week: number | null })[]; back: string }) {
  const weeks = [...new Set(files.map((f) => f.week).filter((w): w is number => w != null))].sort((a, b) => a - b)
  if (!weeks.length) return <Empty text="Topics appear here once files are sorted by week (step 6)." />
  return (
    <div className="space-y-4">
      {weeks.map((w) => (
        <div key={w}>
          <h2 className="mb-1.5 text-sm font-medium">Week {w}</h2>
          <FileList files={files.filter((f) => f.week === w).sort(compareFiles)} back={back} />
        </div>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{text}</p>
}
