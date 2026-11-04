import assert from 'node:assert/strict'
import { parseSheet, parseModuleCode, normaliseSheet, compareSheets } from '../src/lib/sheets'

const cases: [string, string | null][] = [
  ['Worksheet1.2.pdf', '1.2'],
  ['Worksheet1_2.pdf', '1.2'],
  ['COMP2860_Worksheet1_1.pdf', '1.1'],
  ['COMP2860_Worksheet1_1_template.docx', '1.1'],
  ['Worksheet 3-4 solutions.pdf', '3.4'],
  ['worksheet10.1.pdf', '10.1'],
  ['Lecture1.2.pdf', null],
  ['COMP2860_Lecture_Worksheet1_2.pptx', null],
  ['Slides 2.1.pptx', null],
  ['notes.pdf', null],
  ['Homeworksheet1.2.pdf', null],
  ['Quiz2.1.pdf', '2.1'],
]
for (const [input, want] of cases) assert.equal(parseSheet(input), want, input)

assert.equal(parseModuleCode('COMP2860_Worksheet1_1.pdf'), 'COMP2860')
assert.equal(parseModuleCode('comp2860-ws1.pdf'), 'COMP2860')
assert.equal(parseModuleCode('XCOMP28601.pdf'), null)
assert.equal(normaliseSheet(' 01_02 '), '1.2')
assert.equal(normaliseSheet('1'), null)
assert.deepEqual(['1.10', '1.2', '2.1', '1.9'].sort(compareSheets), ['1.2', '1.9', '1.10', '2.1'])
console.log('sheets: all passed')
