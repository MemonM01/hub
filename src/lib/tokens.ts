import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

/** A new secret token. Only its hash is stored; the prefix is shown in Settings. */
export function newToken(kind: 'sync' | 'mcp' | 'refresh' | 'code') {
  const tag = { sync: 'hub_sync_', mcp: 'hub_mcp_', refresh: 'hub_rt_', code: 'hub_code_' }[kind]
  const token = tag + randomBytes(32).toString('base64url')
  return { token, hash: sha256(token), prefix: token.slice(0, tag.length + 6) }
}
