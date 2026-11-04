'use client'

import { useTransition } from 'react'
import { setModuleArchived } from '@/lib/actions/modules'

export function ArchiveButton({ moduleId, archived }: { moduleId: string; archived: boolean }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setModuleArchived(moduleId, !archived))}
      className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:text-ink disabled:opacity-60"
    >
      {archived ? 'Unarchive' : 'Archive'}
    </button>
  )
}
