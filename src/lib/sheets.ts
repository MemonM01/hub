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

/** Normalise what I type: ' 1_2 ', '1-2', '01.02' -> '1.2'. */
export function normaliseSheet(input: string): string | null {
  const m = /^\s*(\d{1,2})\s*[._\-\s]\s*(\d{1,2})\s*$/.exec(input)
  if (!m) return null
  return `${Number(m[1])}.${Number(m[2])}`
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

/** Sort '1.10' after '1.9'. */
export function compareSheets(a: string, b: string): number {
  const [a1, a2] = a.split('.').map(Number)
  const [b1, b2] = b.split('.').map(Number)
  return a1 - b1 || a2 - b2
}

function stripExtension(filename: string) {
  // Only a real extension (has a letter): 'Worksheet 1.5' keeps its .5
  return filename.replace(/\.(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{1,5}$/, '')
}
