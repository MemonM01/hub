import assert from 'node:assert/strict'
import { compareFiles } from '../src/lib/order'
const f = (filename: string, kind: string | null, title: string | null = null, week: number | null = null) => ({ filename, kind, title, week })
const list = [
  f('w15s.pdf', 'solution', 'Worksheet 1.5 Solutions (pdf)'),
  f('lab02_working-with-numpy.ipynb', 'lab_sheet'),
  f('COMP2860_Worksheet1_10.pdf', 'worksheet'),
  f('COMP2860_Worksheet1_2.pdf', 'worksheet'),
  f('lab01_solutions.pdf', 'solution', 'Lab 1 - solutions (pdf)'),
  f('lab01_floating-point-numbers.ipynb', 'lab_sheet'),
  f('tmpl.docx', 'submission_template', 'Submission Template Worksheet 1.5'),
  f('COMP2860_Worksheet1_5.pdf', 'worksheet'),
  f('Session 10 slides.pdf', 'lecture_slides', null, 2),
  f('Session 2 slides.pdf', 'lecture_slides', null, 2),
]
console.log(list.sort(compareFiles).map((x) => x.title ?? x.filename).join('\n'))
assert.equal(list[0].filename, 'COMP2860_Worksheet1_2.pdf')
assert.equal(list[2].filename, 'tmpl.docx')
assert.equal(list[3].filename, 'w15s.pdf')
assert.equal(list[4].filename, 'COMP2860_Worksheet1_10.pdf')
console.log('order: passed')
