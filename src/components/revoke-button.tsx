'use client'

import { useTransition } from 'react'
import { revokeSyncToken } from '@/lib/actions/tokens'

export function RevokeButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => revokeSyncToken(id))}
      className="text-xs text-danger hover:underline disabled:opacity-60"
    >
      {pending ? 'Revoking…' : 'Revoke'}
    </button>
  )
}
