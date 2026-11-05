import { compareSheets, parseSheet } from '@/lib/sheets'

type Orderable = { filename: string; title: string | null; kind: string | null; week?: number | null }

const collator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' })
const KIND_ORDER = ['worksheet', 'lab_sheet', 'quiz', 'coursework', 'submission_template', 'solution']

function labNumber(f: Orderable): number | null {
  const m = /(?<![A-Za-z])lab[\s_-]*0*(\d{1,2})(?!\d)/i.exec(`${f.title ?? ''} ${f.filename}`)
  return m ? Number(m[1]) : null
}

/** 'Sheet 1.2', 'Lab 3', or null. Used to group the Worksheets folder. */
export function groupOf(f: Orderable): { key: string; label: string; sort: [number, number, number] } | null {
  const sheet = parseSheet(f.filename) ?? (f.title ? parseSheet(f.title) : null)
  if (sheet) {
    const [a, b] = sheet.split('.').map(Number)
    return { key: `s${sheet}`, label: `Sheet ${sheet}`, sort: [0, a, b] }
  }
  const lab = labNumber(f)
  if (lab != null) return { key: `l${lab}`, label: `Lab ${lab}`, sort: [1, lab, 0] }
  return null
}

function kindRank(kind: string | null) {
  const i = KIND_ORDER.indexOf(kind ?? '')
  return i === -1 ? KIND_ORDER.length : i
}

/** Natural order: week, then sheet or lab, then worksheet before template before solutions, then name. */
export function compareFiles(a: Orderable, b: Orderable): number {
  const ga = groupOf(a)
  const gb = groupOf(b)
  if (ga && gb) {
    const d = ga.sort[0] - gb.sort[0] || ga.sort[1] - gb.sort[1] || ga.sort[2] - gb.sort[2]
    if (d) return d
  } else if (ga || gb) {
    return ga ? -1 : 1
  } else {
    const wa = a.week ?? 999
    const wb = b.week ?? 999
    if (wa !== wb) return wa - wb
  }
  return kindRank(a.kind) - kindRank(b.kind) || collator.compare(a.title ?? a.filename, b.title ?? b.filename)
}

export { compareSheets }
