'use client'

import { useActionState } from 'react'
import { addModule, type FormState } from '@/lib/actions/modules'

export function AddModuleForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addModule, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="text-xs text-muted">Module code</span>
        <input name="code" required placeholder="COMP2860" className="field mt-1 w-36 uppercase" />
      </label>
      <label className="block min-w-48 flex-1">
        <span className="text-xs text-muted">Name (optional)</span>
        <input name="name" placeholder="Software Engineering" className="field mt-1" />
      </label>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Adding…' : 'Add module'}
      </button>
      {state.error ? <p role="alert" className="w-full text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="w-full text-sm text-muted">{state.ok}</p> : null}
    </form>
  )
}
