'use client'

import { useTransition } from 'react'
import { revokeClient } from '@/lib/actions/oauth'

export function DisconnectButton({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => revokeClient(clientId))}
      className="text-xs text-danger hover:underline disabled:opacity-60"
    >
      {pending ? 'Disconnecting…' : 'Disconnect'}
    </button>
  )
}
