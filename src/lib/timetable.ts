import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseIcs, toSession } from '@/lib/ics'

export const MAX_ICS_BYTES = 5 * 1024 * 1024

/**
 * Import my MyTimetable export. One row per VEVENT, keyed by its UID, so importing again updates
 * those sessions instead of adding duplicates. Sessions no longer in the file are removed.
 */
export async function importIcs(db: SupabaseClient, userId: string, text: string) {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('That is not an .ics calendar file.')
  const sessions = parseIcs(text).map(toSession)
  if (!sessions.length) throw new Error('The calendar has no sessions in it.')

  const { data: modules } = await db.from('modules').select('id, code').eq('user_id', userId)
  const moduleId = new Map((modules ?? []).map((m) => [m.code, m.id]))

  const rows = sessions.map((s) => ({
    user_id: userId,
    uid: s.uid.slice(0, 300),
    module_code: s.moduleCode,
    module_id: s.moduleCode ? (moduleId.get(s.moduleCode) ?? null) : null,
    module_name: s.moduleName,
    activity_type: s.activityType,
    staff: s.staff,
    recording_status: s.recordingStatus,
    location: s.location,
    summary: s.summary,
    starts_at: s.start,
    ends_at: s.end,
  }))
  // Same UID twice in one file: keep the last.
  const byUid = new Map(rows.map((r) => [r.uid, r]))
  const unique = [...byUid.values()]
  for (let i = 0; i < unique.length; i += 500) {
    const { error } = await db.from('timetable_sessions').upsert(unique.slice(i, i + 500), { onConflict: 'user_id,uid' })
    if (error) throw new Error(error.message)
  }

  // Remove sessions that are no longer in my timetable.
  const { data: existing } = await db.from('timetable_sessions').select('id, uid').eq('user_id', userId)
  const gone = (existing ?? []).filter((r) => !byUid.has(r.uid)).map((r) => r.id)
  for (let i = 0; i < gone.length; i += 200) {
    await db.from('timetable_sessions').delete().eq('user_id', userId).in('id', gone.slice(i, i + 200))
  }

  return {
    sessions: unique.length,
    matched: unique.filter((r) => r.module_id).length,
    removed: gone.length,
    unmatchedCodes: [...new Set(unique.filter((r) => r.module_code && !r.module_id).map((r) => r.module_code!))],
  }
}

/** The private MyTimetable feed link, set as a Vercel secret. Only that host is accepted. */
export function timetableUrl(): string | null {
  const raw = process.env.TIMETABLE_ICS_URL
  if (!raw) return null
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && u.hostname === 'mytimetable.leeds.ac.uk' ? u.toString() : null
  } catch {
    return null
  }
}
