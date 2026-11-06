import Link from 'next/link'
import type { Metadata } from 'next'
import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { requireUserId } from '@/lib/auth'
import { createClient, requestNow } from '@/lib/supabase/server'
import { getAssignments, getModules } from '@/lib/data'
import { compareSheets, sheetLabel } from '@/lib/sheets'
import { TZ } from '@/lib/format'
import { DONE, type Assignment } from '@/lib/types'
import { AddAssignmentForm } from '@/components/add-assignment-form'
import { StatusSelect } from '@/components/status-select'
import { AssignmentRowDrop, AssignmentsDropZone } from '@/components/assignment-drop'
import { DueEdit } from '@/components/due-edit'
import { dueText } from '@/lib/due-text'
import { moduleColors } from '@/lib/module-color'
import { ModuleTag } from '@/components/module-tag'

export const instant = false
export const metadata: Metadata = { title: 'Assignments' }

type AttachedFile = {
  id: string
  filename: string
  title: string | null
  assignment_id: string
}

export default async function AssignmentsPage() {
  await requireUserId()
  const supabase = await createClient()
  const now = await requestNow()
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
  const codeOf = new Map(modules.map((m) => [m.id, m.code]))
  const live = assignments.filter((a) => a.status !== 'cancelled' && codeOf.has(a.module_id))
  const todo = live
    .filter((a) => !DONE.includes(a.status))
    .sort((a, b) => (a.due_at ?? '9').localeCompare(b.due_at ?? '9') || compareSheets(a.sheet, b.sheet))
  const done = live.filter((a) => DONE.includes(a.status))
  const color = moduleColors(modules.map((m) => m.code))

  const row = (a: Assignment, showModule: boolean) => {
    const attached = files.filter((f) => f.assignment_id === a.id)
    const code = codeOf.get(a.module_id)!
    const due = a.due_at ? dueText(a.due_at, now) : null
    const isDone = DONE.includes(a.status)
    const dueValue = a.due_at ? format(new TZDate(a.due_at, TZ), 'yyyy-MM-dd') : ''
    return (
      <AssignmentRowDrop key={a.id} assignmentId={a.id}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {showModule ? <ModuleTag code={code} color={color.get(code)} className="w-24 shrink-0" /> : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {sheetLabel(a)}
              {a.title && /^\d+\.\d+$/.test(a.sheet) ? <span className="font-normal text-muted"> {a.title}</span> : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
              {isDone ? null : (
                <DueEdit id={a.id} value={dueValue} label={due ? due.text : 'Add a due date'} tone={due?.tone ?? 'text-muted'} />
              )}
              {attached.map((f) => (
                <Link
                  key={f.id}
                  href={`/files/${f.id}?from=${encodeURIComponent('/assignments')}`}
                  prefetch={false}
                  className="truncate underline-offset-2 hover:underline"
                >
                  {f.title ?? f.filename}
                </Link>
              ))}
            </div>
          </div>
          <StatusSelect id={a.id} status={a.status} />
        </div>
      </AssignmentRowDrop>
    )
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
        <p className="mt-1 text-sm text-muted">
          Each sheet is due 10 working days after it comes out. Click a due date to change it.
        </p>
      </header>

      {modules.length === 0 ? (
        <p className="text-sm text-muted">
          Add a module first on{' '}
          <Link href="/modules" prefetch={false} className="underline">
            Modules
          </Link>
          .
        </p>
      ) : null}

      <AssignmentsDropZone>
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-base font-semibold">
              To do <span className="font-normal text-muted">{todo.length}</span>
            </h2>
            {todo.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
                {todo.map((a) => row(a, true))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-line px-5 py-6 text-sm text-muted">Nothing to do. Nice.</p>
            )}
          </div>

          {done.length ? (
            <details className="group">
              <summary className="cursor-pointer list-none text-base font-semibold">
                <span className="mr-1 inline-block transition group-open:rotate-90">›</span> Done{' '}
                <span className="font-normal text-muted">{done.length}</span>
              </summary>
              <div className="mt-3 space-y-5">
                {modules.map((m) => {
                  const rows = done.filter((a) => a.module_id === m.id).sort((a, b) => compareSheets(a.sheet, b.sheet))
                  if (!rows.length) return null
                  return (
                    <div key={m.id}>
                      <h3 className="mb-2">
                        <ModuleTag code={m.code} color={color.get(m.code)} />
                      </h3>
                      <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface opacity-80 shadow-[0_0_0_1px_var(--line)]">
                        {rows.map((a) => row(a, false))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </details>
          ) : null}
        </div>
      </AssignmentsDropZone>

      {modules.length ? <AddAssignmentForm modules={modules} /> : null}
    </section>
  )
}
