import { TZDate } from '@date-fns/tz'
import { TZ } from '@/lib/format'

// Teaching week 1 of semester 1 starts on this Monday (my first timetabled session).
export const TERM_START = { y: 2026, m: 9, d: 28 }

// A sheet comes out on the Monday of its week and I have 10 working days:
// that ends on the Friday of the following week.
const WORKING_DAYS = 10

/** Monday of teaching week n, as a Leeds date. */
function mondayOf(week: number) {
  return new TZDate(TERM_START.y, TERM_START.m - 1, TERM_START.d + (week - 1) * 7, 0, 0, TZ)
}

/** Due date for a release week: the 10th working day, counting the release Monday, at 23:59. */
export function dueForWeek(week: number): string {
  const start = mondayOf(week)
  // 10 working days from a Monday = Mon..Fri, Mon..Fri: 11 days later.
  const days = WORKING_DAYS + Math.floor((WORKING_DAYS - 1) / 5) * 2 - 1
  return new Date(
    new TZDate(start.getFullYear(), start.getMonth(), start.getDate() + days, 23, 59, TZ).getTime(),
  ).toISOString()
}

/** Release week from a semester 1 sheet number ('1.6' -> 6). Null when unknown. */
export function weekOfSheet(sheet: string): number | null {
  const m = /^1\.(\d{1,2})$/.exec(sheet)
  return m ? Number(m[1]) : null
}

/** Default due date for a new row. */
export function defaultDue(sheet: string, week?: number | null): string | null {
  const w = weekOfSheet(sheet) ?? week ?? null
  return w && w >= 1 && w <= 12 ? dueForWeek(w) : null
}

/** Current teaching week for a moment (1-based), or null outside term. */
export function teachingWeek(now: Date): number | null {
  const ms = now.getTime() - mondayOf(1).getTime()
  if (ms < 0) return null
  const w = Math.floor(ms / (7 * 24 * 3600 * 1000)) + 1
  return w <= 12 ? w : null
}
