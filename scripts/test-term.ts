import assert from 'node:assert/strict'
import { dueForWeek, defaultDue, teachingWeek } from '../src/lib/term'
import { compareSheets, normaliseSheet, parseLab, sheetLabel } from '../src/lib/sheets'

assert.equal(dueForWeek(1), '2026-10-09T22:59:00.000Z') // BST
assert.equal(dueForWeek(6), '2026-11-13T23:59:00.000Z') // GMT
assert.equal(defaultDue('1.6'), dueForWeek(6))
assert.equal(defaultDue('Lab 3'), null)
assert.equal(defaultDue('Reflection 6', 6), dueForWeek(6))
assert.equal(teachingWeek(new Date('2026-11-06T12:00:00Z')), 6)
assert.equal(teachingWeek(new Date('2026-09-01T12:00:00Z')), null)
assert.equal(parseLab('lab03_linear_systems_of_equations.ipynb'), 'Lab 3')
assert.equal(parseLab('Lecture 3 slides.pdf'), null)
assert.equal(normaliseSheet('lab 04'), 'Lab 4')
assert.equal(normaliseSheet('01'), null)
assert.equal(normaliseSheet('Reflection 6'), 'Reflection 6')
assert.deepEqual(['Lab 2', '1.10', 'Lab 10', '1.2'].sort(compareSheets), ['1.2', '1.10', 'Lab 2', 'Lab 10'])
assert.equal(sheetLabel({ sheet: '1.2' }), 'Sheet 1.2')
assert.equal(sheetLabel({ sheet: 'Reflection 6', title: 'Week 6 reflections' }), 'Week 6 reflections')
console.log('term ok')
