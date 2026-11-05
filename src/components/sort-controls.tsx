'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fileManually, resortAll, resortFile, sortSome } from '@/lib/actions/sorting'
import { KIND_LABEL, type Module } from '@/lib/types'



export function SortBacklog({ waiting, total }: { waiting: number; total: number }) {
  const router = useRouter()
  const [left, setLeft] = useState(waiting)
  const [running, setRunning] = useState(false)
  if (!waiting && !running) {
    if (!total) return null
    return (
      <button
        type="button"
        className="text-xs text-muted underline"
        onClick={async () => {
          await resortAll()
          router.refresh()
        }}
      >
        Sort every file again (files you filed by hand are left alone)
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm">
      <span>
        {running
          ? `Sorting… ${left} left (about 4 a minute on free AI credit, keep this page open)`
          : `${waiting} file(s) waiting for the sorter.`}
      </span>
      {!running ? (
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            setRunning(true)
            let n = waiting
            let stalls = 0
            while (n > 0 && stalls < 5) {
              const started = Date.now()
              const res = await sortSome()
              n = res.left
              setLeft(n)
              router.refresh()
              stalls = res.done ? 0 : stalls + 1
              // About 4 a minute keeps under the free tier's 5 requests a minute.
              const wait = (res.rateLimited ? 30000 : 15000) - (Date.now() - started)
              if (n > 0 && wait > 0) await new Promise((r) => setTimeout(r, wait))
            }
            setRunning(false)
          }}
        >
          Sort them now
        </button>
      ) : null}
    </div>
  )
}

export function FilingForm({
  fileId,
  modules,
  current,
  topics = [],
}: {
  fileId: string
  modules: Module[]
  current: { moduleId: string | null; week: number | null; kind: string | null; sheet: string | null; topic?: string | null }
  topics?: string[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-xl bg-surface p-3 shadow-[0_0_0_1px_var(--line)]"
      action={(fd) =>
        start(async () => {
          const week = Number(fd.get('week'))
          const res = await fileManually(fileId, {
            moduleId: String(fd.get('module') || '') || null,
            week: Number.isInteger(week) && week > 0 ? week : null,
            kind: String(fd.get('kind') || '') || null,
            sheet: String(fd.get('sheet') || '').trim() || null,
            topic: String(fd.get('topic') || '').trim() || null,
          })
          if (res.error) setError(res.error)
          else {
            setError(undefined)
            setSaved(true)
            router.refresh()
          }
        })
      }
    >
      <label className="block">
        <span className="text-xs text-muted">Module</span>
        <select name="module" defaultValue={current.moduleId ?? ''} className="field mt-1 w-32 py-1.5 text-sm">
          <option value="">None</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-muted">Kind</span>
        <select name="kind" defaultValue={current.kind ?? ''} className="field mt-1 w-44 py-1.5 text-sm">
          <option value="">Unknown</option>
          {Object.entries(KIND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-muted">Topic</span>
        <input name="topic" list={`ft-${fileId}`} defaultValue={current.topic ?? ''} className="field mt-1 w-44 py-1.5 text-sm" />
        <datalist id={`ft-${fileId}`}>
          {topics.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label className="block">
        <span className="text-xs text-muted">Week</span>
        <input name="week" type="number" min={1} max={30} defaultValue={current.week ?? ''} className="field mt-1 w-20 py-1.5 text-sm" />
      </label>
      <label className="block">
        <span className="text-xs text-muted">Sheet</span>
        <input name="sheet" placeholder="1.2" defaultValue={current.sheet ?? ''} className="field mt-1 w-20 py-1.5 text-sm" />
      </label>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Saving…' : 'File it'}
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
        onClick={() => start(async () => { await resortFile(fileId); router.refresh() })}
      >
        Run sorter again
      </button>
      <p className="w-full text-xs text-muted">
        {error ? <span className="text-danger">{error}</span> : saved ? 'Filed. The sorter will not move it again.' : 'Filing by hand pins it, so the sorter never moves it.'}
      </p>
    </form>
  )
}
