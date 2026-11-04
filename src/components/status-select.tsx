'use client'

import { useOptimistic, useTransition } from 'react'
import { setAssignmentStatus } from '@/lib/actions/assignments'
import { STATUSES, STATUS_LABEL, type Status } from '@/lib/types'

const TONE: Record<Status, string> = {
  not_started: 'text-muted',
  in_progress: 'text-ink',
  submitted: 'text-accent',
  graded: 'text-accent',
  cancelled: 'text-muted line-through',
}

export function StatusSelect({ id, status }: { id: string; status: Status }) {
  const [pending, start] = useTransition()
  const [value, setValue] = useOptimistic(status)
  return (
    <select
      aria-label="Status"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Status
        start(async () => {
          setValue(next)
          await setAssignmentStatus(id, next)
        })
      }}
      className={`rounded-md border border-line bg-paper px-2 py-1 text-xs ${TONE[value]}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  )
}
