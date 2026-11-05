import assert from 'node:assert/strict'
import { parseIcs, toSession } from '../src/lib/ics'

const sample = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:abc-123@mytimetable',
  'DTSTART;TZID=Europe/London:20261103T090000',
  'DTEND;TZID=Europe/London:20261103T110000',
  'SUMMARY:COMP2850 Software Engineering Lecture',
  'LOCATION:Michael Sadler RBLT (LG.X04)',
  'DESCRIPTION:Module code: COMP2850/01\\nModule Name: Software Engineering\\nActiv',
  ' ity/Session Type: Lecture\\nStaff member(s): Smith\\, Jane\\nRecording status: Recorded',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:summer-1',
  'DTSTART:20260601T130000',
  'DTEND:20260601T140000',
  'SUMMARY:COMP2870 Tutorial',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:utc-1',
  'DTSTART:20261103T090000Z',
  'DTEND:20261103T100000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

const events = parseIcs(sample)
assert.equal(events.length, 3)
const s = toSession(events[0])
assert.equal(s.start, '2026-11-03T09:00:00.000Z') // GMT in November
assert.equal(s.moduleCode, 'COMP2850')
assert.equal(s.moduleName, 'Software Engineering')
assert.equal(s.activityType, 'Lecture')
assert.equal(s.staff, 'Smith, Jane')
assert.equal(s.recordingStatus, 'Recorded')
assert.equal(toSession(events[1]).start, '2026-06-01T12:00:00.000Z') // BST, floating = London
assert.equal(toSession(events[1]).moduleCode, 'COMP2870')
assert.equal(events[2].start, '2026-11-03T09:00:00.000Z')
console.log('ics: passed')
