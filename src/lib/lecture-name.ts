import { format } from 'date-fns'

/** "COMP286001/LEC 1/01 29/10/2026 11:00 Michael Sadler RBLT (LG.X04)" -> "Lecture 29 Oct, 11:00" */
export function lectureName(title: string) {
  const m = /\/(LEC|TUT|LAB|WOR|SEM)\w*\s*[\d/]*\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/i.exec(title)
  if (!m) return title
  const kind = { LEC: 'Lecture', TUT: 'Tutorial', LAB: 'Lab', WOR: 'Workshop', SEM: 'Seminar' }[m[1].toUpperCase().slice(0, 3)] ?? 'Session'
  const d = new Date(Date.UTC(+m[4], +m[3] - 1, +m[2]))
  return `${kind} ${format(d, 'd MMM')}, ${m[5]}`
}
