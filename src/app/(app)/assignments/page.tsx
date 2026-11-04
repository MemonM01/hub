import Link from 'next/link'
import type { Metadata } from 'next'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAssignments, getModules } from '@/lib/data'
import { compareSheets } from '@/lib/sheets'
import { formatDateTime } from '@/lib/format'
import { AddAssignmentForm } from '@/components/add-assignment-form'
import { StatusSelect } from '@/components/status-select'

export const instant = false
export const metadata: Metadata = { title: 'Assignments' }

type AttachedFile = { id: string; filename: string; title: string | null; assignment_id: string }

export default async function AssignmentsPage() {
  await requireUserId()
  const supabase = await createClient()
  const [modules, assignments, filesRes] = await Promise.all([
    getModules(),
    getAssignments(),
    supabase
      .from('files')
      .select('id, filename, title, assignment_id')
      .not('assignment_id', 'is', null)
      .not('size_bytes', 'is', null), // names without bytes are not files
  ])
  const files = (filesRes.data ?? []) as AttachedFile[]
  const visible = assignments.filter((a) => a.status !== 'cancelled')

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
      {modules.length === 0 ? (
        <p className="text-sm text-muted">
          Add a module first on{' '}
          <Link href="/modules" prefetch={false} className="underline">
            Modules
          </Link>
          .
        </p>
      ) : (
        <AddAssignmentForm modules={modules} />
      )}

      {modules.map((m) => {
        const rows = visible.filter((a) => a.module_id === m.id).sort((a, b) => compareSheets(a.sheet, b.sheet))
        if (!rows.length) return null
        return (
          <div key={m.id}>
            <h2 className="mb-2 flex items-baseline gap-2">
              <Link href={`/modules/${m.code}`} prefetch={false} className="font-mono font-medium hover:underline">
                {m.code}
              </Link>
              {m.name ? <span className="text-sm text-muted">{m.name}</span> : null}
            </h2>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {rows.map((a) => {
                const attached = files.filter((f) => f.assignment_id === a.id)
                const back = '/assignments'
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <span className="w-10 font-mono text-sm tabular-nums">{a.sheet}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="truncate">{a.title ?? (a.is_quiz ? 'Quiz' : 'Worksheet')}</span>
                        {a.is_quiz ? (
                          <span className="rounded bg-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Quiz</span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                        {a.due_at ? <span>Due {formatDateTime(a.due_at)}</span> : null}
                        {attached.length ? (
                          attached.map((f) => (
                            <Link
                              key={f.id}
                              href={`/files/${f.id}?from=${encodeURIComponent(back)}`}
                              prefetch={false}
                              className="truncate underline-offset-2 hover:underline"
                            >
                              {f.title ?? f.filename}
                            </Link>
                          ))
                        ) : (
                          <span>No file yet</span>
                        )}
                      </div>
                    </div>
                    <StatusSelect id={a.id} status={a.status} />
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      {modules.length > 0 && visible.length === 0 ? (
        <p className="text-sm text-muted">No assignments yet.</p>
      ) : null}
    </section>
  )
}
