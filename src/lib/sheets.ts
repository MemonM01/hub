// Sheet numbers and module codes from filenames.
// Note: \b is wrong here because `_` is a word character, so "Worksheet1_1" has no
// boundary before the 1. We use explicit lookarounds on letters/digits instead.

const LECTURE = /(?<![A-Za-z])(lecture|lect|slides?|recording)(?![A-Za-z])/i
const SHEET =
  /(?<![A-Za-z])(?:worksheet|work[\s_-]sheet|exercise[\s_-]?sheet|problem[\s_-]?sheet|sheet|ws|quiz)[\s_-]*(\d{1,2})[._-](\d{1,2})(?!\d)/i
const MODULE_CODE = /(?<![A-Za-z0-9])([A-Z]{4})[\s_-]?(\d{4})(?!\d)/i

/** '1.2' from 'COMP2860_Worksheet1_2.pdf'. Null for lectures and anything without a sheet. */
export function parseSheet(filename: string): string | null {
  const name = stripExtension(filename)
  if (LECTURE.test(name)) return null
  const m = SHEET.exec(name)
  if (!m) return null
  return `${Number(m[1])}.${Number(m[2])}`
}

/** 'COMP2860' from 'comp2860_Worksheet1_1.pdf'. */
export function parseModuleCode(filename: string): string | null {
  const m = MODULE_CODE.exec(stripExtension(filename))
  return m ? `${m[1].toUpperCase()}${m[2]}` : null
}

const LAB = /(?<![A-Za-z])lab[\s_-]*(\d{1,2})(?!\d)/i

/** 'Lab 3' from 'lab03_linear_systems.ipynb'. */
export function parseLab(filename: string): string | null {
  const m = LAB.exec(stripExtension(filename))
  return m ? `Lab ${Number(m[1])}` : null
}

/**
 * Normalise what I type: ' 1_2 ', '1-2', '01.02' -> '1.2', 'lab 03' -> 'Lab 3'.
 * Anything else short (e.g. 'Reflection 6') is kept as typed.
 */
export function normaliseSheet(input: string): string | null {
  const m = /^\s*(\d{1,2})\s*[._\-\s]\s*(\d{1,2})\s*$/.exec(input)
  if (m) return `${Number(m[1])}.${Number(m[2])}`
  const lab = /^\s*lab\s*(\d{1,2})\s*$/i.exec(input)
  if (lab) return `Lab ${Number(lab[1])}`
  const text = input.trim().replace(/\s+/g, ' ')
  return /^[A-Za-z][\w .-]{1,39}$/.test(text) ? text : null
}

/** What a row is called: 'Sheet 1.2', 'Quiz 1.3', 'Lab 3', or the title. */
export function sheetLabel(a: { sheet: string; title?: string | null; is_quiz?: boolean }): string {
  if (/^\d+\.\d+$/.test(a.sheet)) return `${a.is_quiz ? 'Quiz' : 'Sheet'} ${a.sheet}`
  return a.title ?? a.sheet
}

/** Module codes as Minerva and Panopto use them: four letters, four digits. */
export function normaliseModuleCode(input: string): string | null {
  const m = /^\s*([A-Za-z]{4})\s*(\d{4})\s*$/.exec(input)
  return m ? `${m[1].toUpperCase()}${m[2]}` : null
}

/** Stable id so a later sync can never create a second row for the same sheet. */
export function assignmentExternalId(moduleId: string, sheet: string): string {
  return `task:${moduleId}:sheet ${sheet}`
}

/** Sort '1.10' after '1.9'; numbered sheets first, then labs and the rest by name. */
export function compareSheets(a: string, b: string): number {
  const na = /^\d+\.\d+$/.test(a)
  const nb = /^\d+\.\d+$/.test(b)
  if (na && nb) {
    const [a1, a2] = a.split('.').map(Number)
    const [b1, b2] = b.split('.').map(Number)
    return a1 - b1 || a2 - b2
  }
  if (na !== nb) return na ? -1 : 1
  return a.localeCompare(b, 'en', { numeric: true })
}

function stripExtension(filename: string) {
  // Only a real extension (has a letter): 'Worksheet 1.5' keeps its .5
  return filename.replace(/\.(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{1,5}$/, '')
}
