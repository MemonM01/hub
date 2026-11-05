export const STATUSES = ['not_started', 'in_progress', 'submitted', 'graded', 'cancelled'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<Status, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  graded: 'Graded',
  cancelled: 'Cancelled',
}

export const DONE: Status[] = ['submitted', 'graded']

export type Module = {
  id: string
  code: string
  name: string | null
  archived: boolean
}

export type Assignment = {
  id: string
  module_id: string
  sheet: string
  title: string | null
  is_quiz: boolean
  status: Status
  due_at: string | null
}

export type FileRow = {
  id: string
  module_id: string | null
  assignment_id: string | null
  filename: string
  title: string | null
  kind: string | null
  size_bytes: number | null
  sort_status: string
  created_at: string
}

// Module page folders and which file kinds land in each.
export const FOLDERS = {
  videos: { label: 'Videos', kinds: [] as string[] },
  slides: { label: 'Slides', kinds: ['lecture_slides', 'lecture_notes'] },
  worksheets: { label: 'Worksheets', kinds: ['worksheet', 'lab_sheet', 'submission_template', 'solution', 'quiz'] },
  assignments: { label: 'Assignments', kinds: ['coursework'] },
  topics: { label: 'Topics', kinds: [] as string[] },
  other: { label: 'Other files', kinds: ['reading', 'other'] },
} as const
export type FolderKey = keyof typeof FOLDERS

export const KIND_LABEL: Record<string, string> = {
  lecture_slides: 'Lecture slides',
  lecture_notes: 'Lecture notes',
  coursework: 'Coursework',
  worksheet: 'Worksheet',
  submission_template: 'Submission template',
  lab_sheet: 'Lab sheet',
  solution: 'Solution',
  quiz: 'Quiz',
  reading: 'Reading',
  other: 'Other',
}
