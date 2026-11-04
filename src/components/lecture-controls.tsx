'use client'

import { useTransition } from 'react'
import { matchFolder, setFolderArchived, setWatched } from '@/lib/actions/lectures'
import type { Module } from '@/lib/types'

export function FolderMatch({
  folderId,
  moduleId,
  modules,
  suggested,
}: {
  folderId: string
  moduleId: string | null
  modules: Module[]
  suggested?: string | null
}) {
  const [pending, start] = useTransition()
  return (
    <select
      aria-label="Module for this folder"
      disabled={pending}
      defaultValue={moduleId ?? ''}
      onChange={(e) => start(() => matchFolder(folderId, e.target.value || null))}
      className="rounded-md border border-line bg-paper px-2 py-1 text-xs"
    >
      <option value="">{suggested ? `Pick a module (looks like ${suggested})` : 'Pick a module'}</option>
      {modules.map((m) => (
        <option key={m.id} value={m.id}>
          {m.code}
        </option>
      ))}
    </select>
  )
}

export function ArchiveFolderButton({ folderId, archived }: { folderId: string; archived: boolean }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setFolderArchived(folderId, !archived))}
      className="text-xs text-muted hover:text-ink disabled:opacity-60"
    >
      {archived ? 'Unarchive' : 'Archive'}
    </button>
  )
}

export function WatchedToggle({ lectureId, watched }: { lectureId: string; watched: boolean }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setWatched(lectureId, !watched))}
      className={`rounded-md border px-2 py-0.5 text-xs disabled:opacity-60 ${
        watched ? 'border-accent text-accent' : 'border-line text-muted hover:text-ink'
      }`}
    >
      {watched ? 'Watched' : 'Mark watched'}
    </button>
  )
}
