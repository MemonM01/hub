import Link from 'next/link'
import { TZDate } from '@date-fns/tz'
import { addDays, format, isSameDay } from 'date-fns'
import { requireUserId } from '@/lib/auth'
import { createClient, requestNow } from '@/lib/supabase/server'
import { getAssignments, getModules, progressFor } from '@/lib/data'
import { DONE } from '@/lib/types'
import { TZ } from '@/lib/format'
import { moduleColors } from '@/lib/module-color'
import { ModuleTag } from '@/components/module-tag'
import { LectureTile, type TileLecture } from '@/components/lecture-tile'
import { compareSheets, sheetLabel } from '@/lib/sheets'
import { dueText } from '@/lib/due-text'
import { teachingWeek } from '@/lib/term'

export const instant = false

type Lecture = TileLecture & { module_id: string | null }
type Session = { id: string; module_code: string | null; activity_type: string | null; location: string | null; summary: string | null; starts_at: string; ends_at: string }

const london = (iso: string | number) => new TZDate(typeof iso === 'number' ? iso : new Date(iso).getTime(), TZ)
const shortName = (s: Session) => s.module_code ?? (s.summary ?? '').replace(/^.*? - /, '').replace(/\/\d+.*$/, '')
const card = 'rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line)]'

export default async function DashboardPage() {
  await requireUserId()
  const supabase = await createClient()
  const now = await requestNow()
  const today = london(now)
  const startToday = new TZDate(today.getFullYear(), today.getMonth(), today.getDate(), TZ)

  const [modules, assignments, lecturesRes, lookRes, sessionsRes] = await Promise.all([
    getModules(),
    getAssignments(),
    supabase
      .from('lectures')
      .select('id, title, delivered_at, duration_seconds, thumbnail_key, module_id, lecture_progress(watched, percent)')
      .not('module_id', 'is', null)
      .order('delivered_at', { ascending: false })
      .limit(300),
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

  // Today's sessions that have not finished, or else the next day with anything on.
  const todays = sessions.filter((s) => isSameDay(london(s.starts_at), today) && new Date(s.ends_at).getTime() > now)
  const nextDay = todays.length ? null : sessions.find((s) => !isSameDay(london(s.starts_at), today))
  const shown = todays.length ? todays : nextDay ? sessions.filter((s) => isSameDay(london(s.starts_at), london(nextDay.starts_at))) : []
  const tomorrow = nextDay && isSameDay(london(nextDay.starts_at), addDays(today, 1))
  const shownDay = todays.length ? 'Today' : nextDay ? (tomorrow ? 'Tomorrow' : format(london(nextDay.starts_at), 'EEEE d MMMM')) : null

  const todo = assignments
    .filter((a) => a.status !== 'cancelled' && !DONE.includes(a.status) && codeOf.has(a.module_id))
    .sort((a, b) => (a.due_at ?? '9').localeCompare(b.due_at ?? '9') || compareSheets(a.sheet, b.sheet))
  const lectures = ((lecturesRes.data ?? []) as unknown as Lecture[]).filter((l) => l.module_id && codeOf.has(l.module_id))
  const unwatched = lectures.filter((l) => !l.lecture_progress?.watched)
  const look = lookRes.count ?? 0

  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const week = teachingWeek(new Date(now))
  const next = shown.find((s) => new Date(s.ends_at).getTime() > now)
  const first = todo[0]

  // One plain sentence on what matters right now.
  const lineParts: string[] = []
  if (next && todays.length) {
    const started = new Date(next.starts_at).getTime() <= now
    lineParts.push(`${started ? 'Now' : 'Next'}: ${shortName(next)} ${next.activity_type?.toLowerCase() ?? ''} ${started ? 'until' : 'at'} ${format(london(started ? next.ends_at : next.starts_at), 'HH:mm')}`.replace(/\s+/g, ' '))
  } else if (!todays.length) {
    lineParts.push('Nothing else on today')
  }
  if (first) lineParts.push(`${sheetLabel(first)} (${codeOf.get(first.module_id)}) is ${first.due_at ? dueText(first.due_at, now).text.toLowerCase() : 'next on your list'}`)

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {format(today, 'EEEE d MMMM')}
            {week ? <span className="ml-2 rounded-full bg-line/70 px-2 py-0.5 text-xs font-medium text-ink">Week {week}</span> : null}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{greeting}</h1>
          {lineParts.length ? <p className="mt-2 max-w-2xl text-[15px] text-muted">{lineParts.join('. ')}.</p> : null}
        </div>
        <div className="flex gap-2">
          <Stat value={todo.length} label="to do" href="/assignments" />
          <Stat value={unwatched.length} label="to watch" href="/lectures" />
        </div>
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
          <SectionHead title={shownDay!} href="/calendar" link="Calendar" />
          <ol className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
            {shown.map((s) => {
              const start = london(s.starts_at)
              const live = now >= start.getTime() && now < new Date(s.ends_at).getTime()
              const tint = s.module_code ? color.get(s.module_code) : undefined
              return (
                <li
                  key={s.id}
                  className={`${card} relative w-56 shrink-0 snap-start overflow-hidden p-4 ${live ? 'ring-2 ring-accent' : ''}`}
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: tint ?? 'var(--line)' }} />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xl font-semibold tabular-nums">{format(start, 'HH:mm')}</span>
                    {live ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-ink">Now</span>
                    ) : (
                      <span className="text-xs tabular-nums text-muted">to {format(london(s.ends_at), 'HH:mm')}</span>
                    )}
                  </div>
                  <div className="mt-2 font-medium">{shortName(s)}</div>
                  <div className="text-sm text-muted">{s.activity_type}</div>
                  {s.location ? <div className="mt-2 truncate text-xs text-muted" title={s.location}>{s.location}</div> : null}
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      <section>
        <SectionHead title="Due next" href="/assignments" link="All assignments" />
        {todo.length ? (
          <ul className={`${card} divide-y divide-line overflow-hidden`}>
            {todo.slice(0, 5).map((a) => {
              const code = codeOf.get(a.module_id)!
              const due = a.due_at ? dueText(a.due_at, now) : null
              return (
                <li key={a.id}>
                  <Link href="/assignments" prefetch={false} className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper">
                    <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: color.get(code) }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{sheetLabel(a)}</span>
                      <span className="block text-xs text-muted">
                        {code}
                        {a.status === 'in_progress' ? ' · in progress' : ''}
                      </span>
                    </span>
                    {due ? <span className={`shrink-0 text-right text-sm ${due.tone}`}>{due.text}</span> : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className={`${card} px-5 py-6 text-sm text-muted`}>Nothing due. You are up to date.</p>
        )}
      </section>

      <section>
        <SectionHead title="Catch up on lectures" href="/lectures" link="All lectures" />
        {unwatched.length ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
            {unwatched.slice(0, 4).map((l) => {
              const code = codeOf.get(l.module_id!)!
              return (
                <li key={l.id}>
                  <LectureTile l={l} code={code} color={color.get(code)} from="/" />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className={`${card} px-5 py-6 text-sm text-muted`}>You have watched everything.</p>
        )}
      </section>

      {modules.length ? (
        <section>
          <SectionHead title="Modules" href="/modules" link="All modules" />
          <ul className="grid gap-3 sm:grid-cols-3">
            {modules.map((m) => {
              const p = progressFor(m.id, assignments)
              const ls = lectures.filter((l) => l.module_id === m.id)
              const watched = ls.filter((l) => l.lecture_progress?.watched).length
              const tint = color.get(m.code)!
              return (
                <li key={m.id}>
                  <Link href={`/modules/${m.code}`} prefetch={false} className={`${card} block p-4 transition hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--ink)]`}>
                    <ModuleTag code={m.code} color={tint} className="text-sm" />
                    <div className="mt-0.5 truncate text-sm text-muted">{m.name ?? ''}</div>
                    <Bar label="Sheets" done={p.done} total={p.total} color={tint} />
                    <Bar label="Lectures" done={watched} total={ls.length} color={tint} />
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

function SectionHead({ title, href, link }: { title: string; href: string; link: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <Link href={href} prefetch={false} className="text-sm text-muted hover:text-ink">
        {link} →
      </Link>
    </div>
  )
}

function Stat({ value, label, href }: { value: number; label: string; href: string }) {
  return (
    <Link href={href} prefetch={false} className={`${card} min-w-24 px-4 py-3 text-center transition hover:shadow-[0_0_0_1px_var(--ink)]`}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Link>
  )
}

function Bar({ label, done, total, color }: { label: string; done: number; total: number; color: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums">
          {done}/{total}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
