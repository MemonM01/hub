import Link from 'next/link'
import { requireUserId } from '@/lib/auth'
import { createClient, requestNow } from '@/lib/supabase/server'
import { getAssignments, getModules, progressFor } from '@/lib/data'
import { DONE } from '@/lib/types'
import { formatDate, formatDateTime } from '@/lib/format'
import { ProgressBar } from '@/components/progress-bar'

export const instant = false

type Lecture = {
  id: string
  title: string
  delivered_at: string | null
  module_id: string | null
  lecture_progress: { watched: boolean } | null
}
type LookFile = { id: string; filename: string; title: string | null; created_at: string }

export default async function DashboardPage() {
  await requireUserId()
  const supabase = await createClient() // calls connection(), so Date.now() below is request time
  const [modules, assignments, lecturesRes, filesRes] = await Promise.all([
    getModules(),
    getAssignments(),
    supabase
      .from('lectures')
      .select('id, title, delivered_at, module_id, lecture_progress(watched)')
      .order('delivered_at', { ascending: false })
      .limit(200),
    supabase
      .from('files')
      .select('id, filename, title, created_at')
      .eq('sort_status', 'needs_look')
      .not('size_bytes', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ])
  const now = await requestNow()
  const codeOf = new Map(modules.map((m) => [m.id, m.code]))

  const upcoming = assignments
    .filter((a) => a.status !== 'cancelled' && !DONE.includes(a.status) && codeOf.has(a.module_id))
    .sort((a, b) => {
      if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at)
      if (a.due_at) return -1
      if (b.due_at) return 1
      return 0
    })
    .slice(0, 8)

  const unwatched = ((lecturesRes.data ?? []) as unknown as Lecture[])
    .filter((l) => !l.lecture_progress?.watched && (!l.module_id || codeOf.has(l.module_id)))
    .slice(0, 8)
  const lookFiles = (filesRes.data ?? []) as LookFile[]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      {modules.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
          Start by adding your modules on{' '}
          <Link href="/modules" prefetch={false} className="underline">
            Modules
          </Link>
          .
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Modules" href="/modules" empty={modules.length === 0}>
          <ul className="space-y-3">
            {modules.map((m) => {
              const p = progressFor(m.id, assignments)
              return (
                <li key={m.id}>
                  <Link href={`/modules/${m.code}`} prefetch={false} className="mb-1 block font-mono text-sm hover:underline">
                    {m.code}
                  </Link>
                  <ProgressBar done={p.done} total={p.total} />
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="Upcoming assignments" href="/assignments" empty={upcoming.length === 0} emptyText="Nothing outstanding.">
          <ul className="divide-y divide-line">
            {upcoming.map((a) => {
              const overdue = a.due_at ? new Date(a.due_at).getTime() < now : false
              return (
                <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-20 shrink-0 font-mono text-xs">{codeOf.get(a.module_id)}</span>
                  <span className="w-10 font-mono tabular-nums">{a.sheet}</span>
                  <span className="min-w-0 flex-1 truncate">{a.title ?? (a.is_quiz ? 'Quiz' : 'Worksheet')}</span>
                  <span className={`text-xs ${overdue ? 'text-danger' : 'text-muted'}`}>
                    {a.due_at ? (overdue ? 'Overdue · ' : '') + formatDateTime(a.due_at) : 'No due date'}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="Unwatched lectures" href="/lectures" empty={unwatched.length === 0} emptyText="Nothing unwatched. Lectures arrive with the Panopto sync.">
          <ul className="divide-y divide-line">
            {unwatched.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-20 shrink-0 font-mono text-xs">{l.module_id ? codeOf.get(l.module_id) : ''}</span>
                <Link href={`/lectures/${l.id}`} prefetch={false} className="min-w-0 flex-1 truncate hover:underline">
                  {l.title}
                </Link>
                <span className="text-xs text-muted">{formatDate(l.delivered_at)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Files that need a look" href="/files" empty={lookFiles.length === 0} emptyText="Nothing to check.">
          <ul className="divide-y divide-line">
            {lookFiles.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2 text-sm">
                <Link href={`/files/${f.id}?from=%2F`} prefetch={false} className="min-w-0 flex-1 truncate hover:underline">
                  {f.title ?? f.filename}
                </Link>
                <span className="text-xs text-muted">{formatDate(f.created_at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function Panel({
  title,
  href,
  empty,
  emptyText = 'Nothing yet.',
  children,
}: {
  title: string
  href: string
  empty: boolean
  emptyText?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</span>
        <Link href={href} prefetch={false} className="text-xs text-muted hover:text-ink">
          All →
        </Link>
      </h2>
      {empty ? <p className="text-sm text-muted">{emptyText}</p> : children}
    </section>
  )
}
