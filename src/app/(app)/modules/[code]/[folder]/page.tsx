import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/auth'
import { getModuleBundle } from '@/lib/module-data'
import { getModules } from '@/lib/data'
import { FOLDERS, STATUS_LABEL, type FileRow, type FolderKey } from '@/lib/types'
import { compareSheets, sheetLabel } from '@/lib/sheets'
import { formatBytes } from '@/lib/format'
import { compareFiles, groupOf } from '@/lib/order'
import { LectureTile, TileGrid } from '@/components/lecture-tile'
import { moduleColors } from '@/lib/module-color'
import { TopicEditor } from '@/components/topic-editor'

export const instant = false

export default async function FolderPage({ params }: PageProps<'/modules/[code]/[folder]'>) {
  await requireUserId()
  const { code, folder } = await params
  if (!(folder in FOLDERS)) notFound()
  const key = folder as FolderKey
  const { module: mod, files, lectures, assignments } = await getModuleBundle(code)
  const here = `/modules/${mod.code}/${key}`
  const tint = moduleColors((await getModules()).map((m) => m.code)).get(mod.code)

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
          <TileGrid>
            {lectures.map((l) => (
              <li key={l.id}>
                <LectureTile l={l} color={tint} from={here} />
              </li>
            ))}
          </TileGrid>
        ) : (
          <Empty text="No lectures yet. Open Panopto and click the hub · Panopto bookmark." />
        )
      ) : key === 'assignments' ? (
        <>
          {assignments.filter((a) => a.status !== 'cancelled').length ? (
            <ul className="divide-y divide-line rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
              {assignments
                .filter((a) => a.status !== 'cancelled')
                .sort((a, b) => compareSheets(a.sheet, b.sheet))
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{sheetLabel(a)}</span>
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
        <div className="space-y-4">
          <TopicEditor moduleId={mod.id} code={mod.code} topics={mod.topics ?? []} />
          <TopicList files={files} topics={mod.topics ?? []} back={here} />
        </div>
      ) : inFolder.length && inFolder.some((f) => f.topic) ? (
        <ByTopic files={inFolder} topics={mod.topics ?? []} back={here} sheets={key === 'worksheets'} />
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
    <ul className="divide-y divide-line rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
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

/** Sections named like on Minerva ("Linear Algebra"), in the order they were taught. */
function ByTopic({
  files,
  topics,
  back,
  sheets,
}: {
  files: (FileRow & { week: number | null; topic: string | null })[]
  topics: string[]
  back: string
  sheets: boolean
}) {
  const extra = [...new Set(files.map((f) => f.topic).filter((t): t is string => !!t && !topics.includes(t)))].sort()
  const groups = [...topics, ...extra].map((t) => ({ key: t, label: t, files: files.filter((f) => f.topic === t) }))
  const rest = files.filter((f) => !f.topic)
  if (rest.length) groups.push({ key: 'other', label: 'Other', files: rest })
  return (
    <div className="space-y-8">
      {groups
        .filter((g) => g.files.length)
        .map((g) => (
          <section key={g.key}>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              {g.label} <span className="text-sm font-normal text-muted">{g.files.length}</span>
            </h2>
            {sheets ? <GroupedList files={g.files} back={back} /> : <FileList files={[...g.files].sort(compareFiles)} back={back} />}
          </section>
        ))}
    </div>
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

function TopicList({
  files,
  topics,
  back,
}: {
  files: (FileRow & { week: number | null; topic: string | null })[]
  topics: string[]
  back: string
}) {
  // Topics in the order they were taught, then any other topics, then by week for the rest.
  const extra = [...new Set(files.map((f) => f.topic).filter((t): t is string => !!t && !topics.includes(t)))].sort()
  const groups: { key: string; label: string; files: typeof files }[] = [...topics, ...extra].map((t) => ({
    key: t,
    label: t,
    files: files.filter((f) => f.topic === t),
  }))
  const rest = files.filter((f) => !f.topic)
  const weeks = [...new Set(rest.map((f) => f.week).filter((w): w is number => w != null))].sort((a, b) => a - b)
  for (const w of weeks) groups.push({ key: `w${w}`, label: `Week ${w}`, files: rest.filter((f) => f.week === w) })
  const loose = rest.filter((f) => f.week == null)
  if (loose.length) groups.push({ key: 'none', label: 'No topic yet', files: loose })
  const shown = groups.filter((g) => g.files.length)
  if (!shown.length) return <Empty text="Nothing here yet." />
  return (
    <div className="space-y-6">
      {shown.map((g) => (
        <div key={g.key}>
          <h2 className="mb-2 text-base font-semibold">
            {g.label} <span className="text-sm font-normal text-muted">{g.files.length}</span>
          </h2>
          <FileList files={[...g.files].sort(compareFiles)} back={back} />
        </div>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{text}</p>
}
