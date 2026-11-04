'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteFile } from '@/lib/actions/files'

export function DeleteFileButton({ fileId, back }: { fileId: string; back: string }) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!armed) return setArmed(true)
          start(async () => {
            const res = await deleteFile(fileId)
            if (!res.ok) return setError(res.error)
            router.replace(back)
          })
        }}
        onBlur={() => setArmed(false)}
        className="rounded-md border border-line px-3 py-1.5 text-sm text-danger hover:border-danger disabled:opacity-60"
      >
        {pending ? 'Deleting…' : armed ? 'Click again to delete' : 'Delete'}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  )
}
