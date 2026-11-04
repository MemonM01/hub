'use client'

import { useActionState } from 'react'
import { addAssignment } from '@/lib/actions/assignments'
import type { FormState } from '@/lib/actions/modules'
import type { Module } from '@/lib/types'

export function AddAssignmentForm({ modules }: { modules: Module[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addAssignment, {})
  if (!modules.length) return null
  return (
    <details className="rounded-lg border border-line p-3" open={!!state.error}>
      <summary className="cursor-pointer text-sm font-medium">Add a sheet by hand</summary>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-xs text-muted">Module</span>
          <select name="module_id" required className="field mt-1 w-36">
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted">Sheet</span>
          <input name="sheet" required placeholder="1.2" inputMode="decimal" className="field mt-1 w-20" />
        </label>
        <label className="block min-w-40 flex-1">
          <span className="text-xs text-muted">Title (optional)</span>
          <input name="title" className="field mt-1" />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Due (optional)</span>
          <input name="due_at" type="datetime-local" className="field mt-1" />
        </label>
        <label className="flex items-center gap-1.5 pb-2 text-sm">
          <input name="is_quiz" type="checkbox" className="accent-[var(--accent)]" /> Quiz
        </label>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Adding…' : 'Add'}
        </button>
        {state.error ? <p role="alert" className="w-full text-sm text-danger">{state.error}</p> : null}
        {state.ok ? <p className="w-full text-sm text-muted">{state.ok}</p> : null}
      </form>
    </details>
  )
}
