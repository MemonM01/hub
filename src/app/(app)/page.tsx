import Link from 'next/link'
import { TZDate } from '@date-fns/tz'
import { addDays, format, isSameDay } from 'date-fns'
import { requireUserId } from '@/lib/auth'
import { createClient, requestNow } from '@/lib/supabase/server'
import { getAssignments, getModules, progressFor } from '@/lib/data'
import { DONE } from '@/lib/types'
import { TZ, formatDate } from '@/lib/format'
import { moduleColors } from '@/lib/module-color'
import { ModuleTag } from '@/components/module-tag'
import { lectureName } from '@/lib/lecture-name'

export const instant = false

type Lecture = { id: string; title: string; delivered_at: string | null; module_id: string | null; lecture_progress: { watched: boolean } | null }
type Session = { id: string; module_code: string | null; activity_type: string | null; location: string | null; summary: string | null; starts_at: string; ends_at: string }

const london = (iso: string) => new TZDate(iso, TZ)
const shortName = (s: Session) => s.module_code ?? (s.summary ?? '').replace(/^.*? - /, '').replace(/\/\d+.*$/, '')

export default async function DashboardPage() {
  await requireUserId()
  const supabase = await createClient()
  const now = await requestNow()
  const today = new TZDate(now, TZ)
  const startToday = new TZDate(today.getFullYear(), today.getMonth(), today.getDate(), TZ)

  const [modules, assignments, lecturesRes, lookRes, sessionsRes] = await Promise.all([
    getModules(),
    getAssignments(),
    supabase.from('lectures').select('id, title, delivered_at, module_id, lecture_progress(watched)').order('delivered_at', { ascending: false }).limit(300),
    supabase.from('files').select('id', { count: 'exact', head: true }).eq('sort_status', 'needs_look').not('size_bytes', 'is', null),
    supabase
      .from('timetable_sessions')
      .select('id, module_code, activity_type, location, summary, starts_at, ends_at')
      .gte('starts_at', new Date(startToday.getTime()).toISOString())
      .lt('starts_at', new Date(addDays(startToday, 14).getTime()).toISOString())
      .order('starts_at')
      .limit(80),
  ])

  const codeOf = new Map(modules.map((m) => [m.id, m.code]))
  const color = moduleColors(modules.map((m) => m.code))
  const sessions = (sessionsRes.data ?? []) as Session[]
  const todays = sessions.filter((s) => isSameDay(london(s.starts_at), today) && new Date(s.ends_at).getTime() > now)
  const nextDay = todays.length ? null : sessions.find((s) => !isSameDay(london(s.starts_at), today))
  const shown = todays.length ? todays : nextDay ? sessions.filter((s) => isSameDay(london(s.starts_at), london(nextDay.starts_at))) : []
  const shownDay = todays.length ? 'Today' : nextDay ? format(london(nextDay.starts_at), 'EEEE d MMMM') : null

  const todo = assignments
    .filter((a) => a.status !== 'cancelled' && !DONE.includes(a.status) && codeOf.has(a.module_id))
    .sort((a, b) => (a.due_at ?? '9').localeCompare(b.due_at ?? '9') || a.sheet.localeCompare(b.sheet, 'en', { numeric: true }))
  const lectures = ((lecturesRes.data ?? []) as unknown as Lecture[]).filter((l) => l.module_id && codeOf.has(l.module_id))
  const unwatched = lectures.filter((l) => !l.lecture_progress?.watched)
  const look = lookRes.count ?? 0

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm text-muted">{format(today, 'EEEE d MMMM')}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {shown.length
            ? `${shown.length} session${shown.length === 1 ? '' : 's'} ${todays.length ? 'today' : 'on ' + format(london(shown[0].starts_at), 'EEEE')}`
            : 'Nothing on your timetable'}
          {todo.length ? `, ${todo.length} sheet${todo.length === 1 ? '' : 's'} to do` : ''}
        </h1>
      </header>

      {modules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-5 py-8 text-sm text-muted">
          Add your modules to get started.{' '}
          <Link href="/modules" prefetch={false} className="font-medium text-accent underline-offset-2 hover:underline">
            Add a module
          </Link>
        </p>
      ) : null}

      {shown.length ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">{shownDay}</h2>
            <Link href="/calendar" prefetch={false} className="text-sm text-muted hover:text-ink">
              Calendar
            </Link>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((s) => {
              const a = london(s.starts_at)
              const live = now >= a.getTime() && now < new Date(s.ends_at).getTime()
              return (
                <li key={s.id} className="relative overflow-hidden rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
                  <span className="absolute inset-y-0 left-0 w-1" style={{ background: s.module_code ? color.get(s.module_code) : 'var(--line)' }} />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-semibold tabular-nums">{format(a, 'HH:mm')}</span>
                    {live ? <span className="text-xs font-medium text-accent">Now</span> : null}
                  </div>
                  <div className="mt-1 text-sm font-medium">{shortName(s)}</div>
                  <div className="text-sm text-muted">{s.activity_type}</div>
                  {s.location ? <div className="mt-2 truncate text-xs text-muted">{s.location}</div> : null}
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">To do</h2>
            <Link href="/assignments" prefetch={false} className="text-sm text-muted hover:text-ink">
              All assignments
            </Link>
          </div>
          {todo.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
              {todo.slice(0, 7).map((a) => {
                const code = codeOf.get(a.module_id)!
                const overdue = a.due_at ? new Date(a.due_at).getTime() < now : false
                return (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <ModuleTag code={code} color={color.get(code)} className="w-24 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium tabular-nums">{a.is_quiz ? 'Quiz' : 'Sheet'} {a.sheet}</span>
                      {a.title ? <span className="text-muted"> {a.title}</span> : null}
                    </span>
                    <span className={`shrink-0 text-xs ${overdue ? 'font-medium text-danger' : 'text-muted'}`}>
                      {a.due_at ? (overdue ? 'Overdue' : 'Due ' + formatDate(a.due_at)) : a.status === 'in_progress' ? 'In progress' : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing outstanding.</p>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Catch up on lectures</h2>
            <Link href="/lectures" prefetch={false} className="text-sm text-muted hover:text-ink">
              All lectures
            </Link>
          </div>
          {unwatched.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
              {unwatched.slice(0, 6).map((l) => {
                const code = codeOf.get(l.module_id!)!
                return (
                  <li key={l.id}>
                    <Link href={`/lectures/${l.id}`} prefetch={false} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-paper">
                      <ModuleTag code={code} color={color.get(code)} className="w-24 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{lectureName(l.title)}</span>
                      <span className="shrink-0 text-xs text-muted">{formatDate(l.delivered_at)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">You are up to date.</p>
          )}
        </section>
      </div>

      {modules.length ? (
        <section>
          <h2 className="mb-3 text-base font-semibold">Modules</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => {
              const p = progressFor(m.id, assignments)
              const ls = lectures.filter((l) => l.module_id === m.id)
              const watched = ls.filter((l) => l.lecture_progress?.watched).length
              return (
                <li key={m.id}>
                  <Link href={`/modules/${m.code}`} prefetch={false} className="block rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--ink)]">
                    <ModuleTag code={m.code} color={color.get(m.code)} />
                    <div className="mt-1 truncate text-sm text-muted">{m.name ?? ''}</div>
                    <Bar label="Sheets done" done={p.done} total={p.total} color={color.get(m.code)!} />
                    <Bar label="Lectures watched" done={watched} total={ls.length} color={color.get(m.code)!} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {look ? (
        <p className="text-sm">
          <Link href="/files" prefetch={false} className="font-medium text-accent underline-offset-2 hover:underline">
            {look} file{look === 1 ? '' : 's'} need a look
          </Link>
          <span className="text-muted"> The sorter was not sure where to put {look === 1 ? 'it' : 'them'}.</span>
        </p>
      ) : null}
    </div>
  )
}

function Bar({ label, done, total, color }: { label: string; done: number; total: number; color: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums">
          {done} of {total}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
