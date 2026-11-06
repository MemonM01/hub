'use client'

import { useState, useTransition } from 'react'
import { setAssignmentDue } from '@/lib/actions/assignments'

/** Click the due date to change it. `value` is the Leeds date, yyyy-mm-dd. */
export function DueEdit({ id, value, label, tone }: { id: string; value: string; label: string; tone?: string }) {
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Change the due date"
        className={`rounded px-1 -mx-1 hover:bg-line/60 ${tone ?? ''}`}
      >
        {pending ? 'Saving…' : label}
      </button>
    )
  }
  return (
    <input
      type="date"
      autoFocus
      defaultValue={value}
      aria-label="Due date"
      className="field w-36 py-0.5 text-xs"
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
      onChange={(e) => {
        const v = e.target.value
        setEditing(false)
        start(() => setAssignmentDue(id, v))
      }}
    />
  )
}
