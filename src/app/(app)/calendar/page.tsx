import type { Metadata } from 'next'
import { TZDate } from '@date-fns/tz'
import { addDays, startOfWeek } from 'date-fns'
import { requireUserId } from '@/lib/auth'
import { createClient, requestNow } from '@/lib/supabase/server'
import { TZ } from '@/lib/format'
import { timetableUrl } from '@/lib/timetable'
import { TimetableImport } from '@/components/timetable-import'
import { CalendarView, parseDay, type Session } from '@/components/calendar/calendar-view'

export const instant = false
export const metadata: Metadata = { title: 'Calendar' }

export default async function CalendarPage({ searchParams }: PageProps<'/calendar'>) {
  await requireUserId()
  const supabase = await createClient()
  const today = new TZDate(await requestNow(), TZ)
  const sp = await searchParams
  const day = parseDay(sp.d, today)
  const weekStart = new TZDate(startOfWeek(day, { weekStartsOn: 1 }), TZ)
  const weekEnd = addDays(weekStart, 7)

  const [{ data }, { count: total }] = await Promise.all([
    supabase
      .from('timetable_sessions')
      .select('id, module_code, module_name, activity_type, staff, location, summary, recording_status, starts_at, ends_at')
      .gte('starts_at', new Date(weekStart.getTime()).toISOString())
      .lt('starts_at', new Date(weekEnd.getTime()).toISOString())
      .order('starts_at'),
    supabase.from('timetable_sessions').select('id', { count: 'exact', head: true }),
  ])
  const sessions = (data ?? []) as Session[]
  const hasLink = !!timetableUrl()

  if (!total) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <TimetableImport hasLink={hasLink} />
      </section>
    )
  }

  return <CalendarView sessions={sessions} day={day} today={today} weekStart={weekStart} hasLink={hasLink} />
}

