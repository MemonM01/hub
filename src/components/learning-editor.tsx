'use client'

import { useActionState, useTransition } from 'react'
import { saveProfile, undoActivity, type SaveState } from '@/lib/actions/learning'

export function LearningEditor({ content }: { content: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProfile, {})
  return (
    <form action={action} className="space-y-2">
      <textarea
        name="content"
        defaultValue={content}
        rows={18}
        placeholder={'How I learn best, what I find hard, what I am working on this term...\n\nThe assistant reads this before helping, and may suggest updates.'}
        className="field font-mono text-sm leading-relaxed"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : 'Save'}
        </button>
        {state.ok ? <span className="text-sm text-muted">{state.ok}</span> : null}
        {state.error ? <span className="text-sm text-danger">{state.error}</span> : null}
      </div>
    </form>
  )
}

export function UndoButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await undoActivity(id)))}
      className="rounded-md border border-line px-2.5 py-1 text-xs hover:border-ink disabled:opacity-60"
    >
      {pending ? 'Undoing…' : 'Undo'}
    </button>
  )
}
