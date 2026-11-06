import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { TZ } from '@/lib/format'

const DAY = 24 * 3600 * 1000

/** 'Due in 3 days', 'Due tomorrow', 'Overdue by 2 days'. */
export function dueText(dueIso: string, now: number) {
  const due = new TZDate(dueIso, TZ)
  const today = new TZDate(now, TZ)
  const days = Math.round(
    (Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / DAY,
  )
  const when = format(due, 'EEE d MMM')
  if (new Date(dueIso).getTime() < now) return { text: `Overdue, was due ${when}`, tone: 'text-danger font-medium' }
  if (days === 0) return { text: 'Due today', tone: 'text-danger font-medium' }
  if (days === 1) return { text: 'Due tomorrow', tone: 'text-[#b7791f] font-medium' }
  if (days <= 7) return { text: `Due ${when}, in ${days} days`, tone: 'text-ink' }
  return { text: `Due ${when}`, tone: 'text-muted' }
}
