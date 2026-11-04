'use server'

import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { newToken } from '@/lib/tokens'

export async function createSyncToken(name: string): Promise<{ token?: string; error?: string }> {
  const userId = await requireUserId()
  const label = name.trim().slice(0, 60) || 'Bookmarklets'
  const { token, hash, prefix } = newToken('sync')
  const supabase = await createClient()
  const { error } = await supabase
    .from('sync_tokens')
    .insert({ user_id: userId, name: label, prefix, token_hash: hash })
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { token } // shown once, never stored in plain text
}

export async function revokeSyncToken(id: string) {
  await requireUserId()
  const supabase = await createClient()
  const { error } = await supabase
    .from('sync_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}
