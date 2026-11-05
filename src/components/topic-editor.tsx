'use client'

import { useState, useTransition } from 'react'
import { setTopics } from '@/lib/actions/links'

/** The order topics were taught in. The Topics folder lists them in this order. */
export function TopicEditor({ moduleId, code, topics }: { moduleId: string; code: string; topics: string[] }) {
  const [value, setValue] = useState(topics.join('\n'))
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)
  return (
    <details className="rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
        Topic order <span className="font-normal text-muted">{topics.length ? topics.join(', then ') : 'not set'}</span>
      </summary>
      <div className="space-y-2 border-t border-line px-4 py-3">
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setSaved(false)
          }}
          rows={Math.max(3, topics.length + 1)}
          placeholder={'One per line, in the order you were taught them'}
          className="field text-sm"
        />
        <button
          type="button"
          disabled={pending}
          className="btn-primary"
          onClick={() =>
            start(async () => {
              await setTopics(moduleId, code, value.split('\n'))
              setSaved(true)
            })
          }
        >
          {pending ? 'Saving…' : 'Save order'}
        </button>
        {saved ? <span className="ml-3 text-sm text-muted">Saved.</span> : null}
      </div>
    </details>
  )
}
