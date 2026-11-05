import Link from 'next/link'
import { TZDate } from '@date-fns/tz'
import { addDays, format, isSameDay } from 'date-fns'
import { TZ } from '@/lib/format'
import { TimetableImport } from '@/components/timetable-import'

export type Session = {
  id: string
  module_code: string | null
  module_name: string | null
  activity_type: string | null
  staff: string | null
  location: string | null
  summary: string | null
  recording_status: string | null
  starts_at: string
  ends_at: string
}


export function parseDay(value: string | string[] | undefined, today: TZDate): TZDate {
  const v = Array.isArray(value) ? value[0] : value
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null
  return m ? new TZDate(+m[1], +m[2] - 1, +m[3], TZ) : new TZDate(today.getFullYear(), today.getMonth(), today.getDate(), TZ)
}
const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
const london = (iso: string) => new TZDate(iso, TZ)
// Sessions with no module (personal tutorials, maths lunch): show the short name from the summary.
const label = (s: { module_code: string | null; summary: string | null }) =>
  s.module_code ?? (s.summary ?? '').replace(/^.*? - /, '').replace(/\s*<[^>]*>\s*$/, '').replace(/\/\d+\s*\w*$/, '').trim()
const minutesOf = (d: TZDate) => d.getHours() * 60 + d.getMinutes()

function tone(type: string | null) {
  const t = (type ?? '').toLowerCase()
  if (t.includes('lecture')) return 'border-l-accent'
  if (t.includes('lab') || t.includes('practical') || t.includes('workshop')) return 'border-l-[#b7791f]'
  if (t.includes('tutorial') || t.includes('seminar')) return 'border-l-[#6b5bd2]'
  return 'border-l-muted'
}

export function CalendarView({
  sessions,
  day,
  today,
  weekStart,
  hasLink,
}: {
  sessions: Session[]
  day: TZDate
  today: TZDate
  weekStart: TZDate
  hasLink: boolean
}) {
  const days = Array.from({ length: 7 }, (_, i) => new TZDate(addDays(weekStart, i), TZ))
  const weekend = sessions.some((s) => [0, 6].includes(london(s.starts_at).getDay()))
  const gridDays = weekend ? days : days.slice(0, 5)
  const firstHour = Math.min(9, ...sessions.map((s) => london(s.starts_at).getHours()))
  const lastHour = Math.max(18, ...sessions.map((s) => Math.ceil(minutesOf(london(s.ends_at)) / 60)))
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)
  const HOUR_PX = 56
  const href = (d: Date) => `/calendar?d=${ymd(d)}`
  const dayItems = sessions.filter((s) => isSameDay(london(s.starts_at), day))

  return (
    <section className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold tracking-tight">Calendar</h1>
        {/* Laptop: move a week at a time */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Weeks">
          <Link href={href(addDays(weekStart, -7))} prefetch={false} className="rounded-md border border-line px-2.5 py-1 text-sm">
            ←
          </Link>
          <Link href="/calendar" prefetch={false} className="rounded-md border border-line px-2.5 py-1 text-sm">
            Today
          </Link>
          <Link href={href(addDays(weekStart, 7))} prefetch={false} className="rounded-md border border-line px-2.5 py-1 text-sm">
            →
          </Link>
          <span className="ml-2 text-sm text-muted">
            {format(weekStart, 'd MMM')} to {format(addDays(weekStart, 6), 'd MMM yyyy')}
          </span>
        </nav>
      </div>

      {/* Phone: one day at a time with a compact nav */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-center gap-2">
          <Link href={href(addDays(day, -1))} prefetch={false} aria-label="Previous day" className="rounded-md border border-line px-3 py-1.5">
            ←
          </Link>
          <div className="flex-1 text-center">
            <div className="text-base font-medium">{format(day, 'EEEE d MMMM')}</div>
            {!isSameDay(day, today) ? (
              <Link href="/calendar" prefetch={false} className="text-xs text-muted underline">
                Back to today
              </Link>
            ) : (
              <div className="text-xs text-muted">Today</div>
            )}
          </div>
          <Link href={href(addDays(day, 1))} prefetch={false} aria-label="Next day" className="rounded-md border border-line px-3 py-1.5">
            →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const n = sessions.filter((s) => isSameDay(london(s.starts_at), d)).length
            const active = isSameDay(d, day)
            return (
              <Link
                key={ymd(d)}
                href={href(d)}
                prefetch={false}
                aria-current={active ? 'date' : undefined}
                className={`rounded-md py-1.5 text-center text-xs ${active ? 'bg-ink text-paper' : 'border border-line'}`}
              >
                <div>{format(d, 'EEEEE')}</div>
                <div className="font-medium">{format(d, 'd')}</div>
                <div className={`mx-auto mt-0.5 h-1 w-1 rounded-full ${n ? (active ? 'bg-paper' : 'bg-accent') : 'bg-transparent'}`} />
              </Link>
            )
          })}
        </div>
        {dayItems.length ? (
          <ul className="space-y-2">
            {dayItems.map((s) => (
              <li key={s.id} className={`rounded-lg border border-line border-l-4 ${tone(s.activity_type)} p-3`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    {format(london(s.starts_at), 'HH:mm')} to {format(london(s.ends_at), 'HH:mm')}
                  </span>
                  <span className={s.module_code ? 'font-mono text-xs' : 'text-xs'}>{label(s)}</span>
                </div>
                <div className="mt-0.5 text-sm">{s.activity_type ?? s.summary}</div>
                {s.location ? <div className="mt-0.5 text-sm text-muted">{s.location}</div> : null}
                {s.staff ? <div className="text-xs text-muted">{s.staff}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Nothing on this day.</p>
        )}
      </div>

      {/* Laptop: the week grid */}
      <div className="hidden overflow-hidden rounded-lg border border-line md:block">
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${gridDays.length}, minmax(0, 1fr))` }}>
          <div className="border-b border-line" />
          {gridDays.map((d) => (
            <div key={ymd(d)} className={`border-b border-l border-line px-2 py-2 text-sm ${isSameDay(d, today) ? 'bg-accent/10 font-medium' : ''}`}>
              {format(d, 'EEE d')}
            </div>
          ))}
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute right-2 text-[11px] text-muted tabular-nums" style={{ top: i * HOUR_PX - 7 }}>
                {i ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>
          {gridDays.map((d) => (
            <div key={ymd(d)} className="relative border-l border-line" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * HOUR_PX }} />
              ))}
              {sessions
                .filter((s) => isSameDay(london(s.starts_at), d))
                .map((s) => {
                  const a = london(s.starts_at)
                  const b = london(s.ends_at)
                  const top = ((minutesOf(a) - firstHour * 60) / 60) * HOUR_PX
                  const height = Math.max(22, ((b.getTime() - a.getTime()) / 3_600_000) * HOUR_PX - 2)
                  return (
                    <div
                      key={s.id}
                      title={[s.module_name, s.activity_type, s.location, s.staff].filter(Boolean).join(' · ')}
                      className={`absolute inset-x-1 overflow-hidden rounded-md border border-line border-l-4 ${tone(s.activity_type)} bg-paper px-1.5 py-1 text-[11px] leading-tight shadow-sm`}
                      style={{ top: top + 1, height }}
                    >
                      <div className={s.module_code ? 'font-mono font-medium' : 'truncate font-medium'}>{label(s)}</div>
                      <div className="truncate">{s.activity_type ?? s.summary}</div>
                      {height > 44 ? <div className="truncate text-muted">{s.location}</div> : null}
                      {height > 60 ? (
                        <div className="text-muted tabular-nums">
                          {format(a, 'HH:mm')} to {format(b, 'HH:mm')}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
      </div>
      {!sessions.length ? <p className="hidden text-sm text-muted md:block">No sessions this week.</p> : null}

      <div className="border-t border-line pt-4">
        <TimetableImport hasLink={hasLink} compact />
      </div>
    </section>
  )
}

