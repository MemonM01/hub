import { TZDate } from '@date-fns/tz'

// A small iCalendar reader for the MyTimetable export. No network, no dates from "now".

export type IcsEvent = {
  uid: string
  summary: string | null
  description: string | null
  location: string | null
  start: string // ISO UTC
  end: string // ISO UTC
}

export type Session = IcsEvent & {
  moduleCode: string | null
  moduleName: string | null
  activityType: string | null
  staff: string | null
  recordingStatus: string | null
}

function unfold(text: string) {
  // Lines that start with a space or tab continue the previous line (RFC 5545 3.1).
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function unescape(v: string) {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\')
}

/** 20261103T090000 with TZID or no zone = Europe/London clock time; trailing Z = UTC. */
export function icsDate(value: string, params: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString()
  const tz = /TZID=([^;:]+)/i.exec(params)?.[1] ?? 'Europe/London'
  const zone = /london|gmt|europe\/london/i.test(tz) ? 'Europe/London' : tz
  try {
    return new Date(new TZDate(+y, +mo - 1, +d, +h, +mi, +s, zone).getTime()).toISOString()
  } catch {
    return new Date(new TZDate(+y, +mo - 1, +d, +h, +mi, +s, "Europe/London").getTime()).toISOString()
  }
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = unfold(text).split('\n')
  const out: IcsEvent[] = []
  let cur: Record<string, { value: string; params: string }> | null = null
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line === 'BEGIN:VEVENT') cur = {}
    else if (line === 'END:VEVENT') {
      if (cur?.UID && cur.DTSTART) {
        const start = icsDate(cur.DTSTART.value, cur.DTSTART.params)
        const end = cur.DTEND ? icsDate(cur.DTEND.value, cur.DTEND.params) : start
        if (start && end) {
          out.push({
            uid: cur.UID.value.trim(),
            summary: cur.SUMMARY ? unescape(cur.SUMMARY.value).trim() : null,
            description: cur.DESCRIPTION ? unescape(cur.DESCRIPTION.value).trim() : null,
            location: cur.LOCATION ? unescape(cur.LOCATION.value).trim() || null : null,
            start,
            end,
          })
        }
      }
      cur = null
    } else if (cur) {
      const colon = line.indexOf(':')
      if (colon < 0) continue
      const head = line.slice(0, colon)
      const [name, ...rest] = head.split(';')
      cur[name.toUpperCase()] = { value: line.slice(colon + 1), params: rest.join(';') }
    }
  }
  return out
}

/** Reads the labelled lines Leeds puts in DESCRIPTION, e.g. "Module code: COMP2850/01". */
function field(desc: string | null, labels: string[]): string | null {
  if (!desc) return null
  for (const label of labels) {
    const re = new RegExp('(?:^|\\n)\\s*' + label.replace(/[()/]/g, '\\$&') + '\\s*:\\s*([^\\n]*)', 'i')
    const m = re.exec(desc)
    if (m && m[1].trim()) return m[1].trim()
  }
  return null
}

export function toSession(e: IcsEvent): Session {
  const codeField = field(e.description, ['Module code', 'Module Code', 'Module'])
  // The module code is the COMP number at the start of the Module code field.
  const code = /^\s*([A-Z]{4})\s?(\d{4})/i.exec(codeField ?? '') ?? /\b([A-Z]{4})(\d{4})\b/.exec(e.summary ?? '')
  return {
    ...e,
    moduleCode: code ? `${code[1].toUpperCase()}${code[2]}` : null,
    moduleName: field(e.description, ['Module Name', 'Module name', 'Module title']),
    activityType: field(e.description, ['Activity/Session Type', 'Session Type', 'Activity Type', 'Type']),
    staff: field(e.description, ['Staff member(s)', 'Staff member', 'Staff', 'Lecturer']),
    recordingStatus: field(e.description, ['Recording status', 'Recording Status', 'Recording']),
  }
}
