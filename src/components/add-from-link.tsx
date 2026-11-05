'use client'

import { useActionState } from 'react'
import { addFromLink, type LinkState } from '@/lib/actions/links'

export function AddFromLink({ moduleId, code, topics }: { moduleId: string; code: string; topics: string[] }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(addFromLink, {})
  return (
    <details className="group rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]" open={!!state.error}>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
        Add from a link
        <span className="ml-2 font-normal text-muted">slides or notes on a website, like a course GitHub page</span>
      </summary>
      <form action={action} className="flex flex-wrap items-end gap-2 border-t border-line px-4 py-3">
        <input type="hidden" name="module_id" value={moduleId} />
        <input type="hidden" name="code" value={code} />
        <label className="block min-w-64 flex-[2]">
          <span className="text-xs text-muted">Link to a file, or a page that lists files</span>
          <input name="url" type="url" required placeholder="https://…/slides/" className="field mt-1 py-1.5 text-sm" />
        </label>
        <label className="block min-w-40 flex-1">
          <span className="text-xs text-muted">Topic (optional)</span>
          <input name="topic" list={`topics-${moduleId}`} placeholder="Linear algebra" className="field mt-1 py-1.5 text-sm" />
          <datalist id={`topics-${moduleId}`}>
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Adding…' : 'Add'}
        </button>
        {state.ok ? <p className="w-full text-sm text-muted">{state.ok} Summaries follow in a minute or two.</p> : null}
        {state.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
      </form>
    </details>
  )
}
