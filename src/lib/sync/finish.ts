import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { headObject } from '@/lib/r2'
import { sortFile } from '@/lib/sorter'

/** Record the real size once the bytes are in R2. Only then does the row count as a file. */
export async function confirmBytes(admin: SupabaseClient, userId: string, fileId: string) {
  const { data: row } = await admin
    .from('files')
    .select('id, r2_key')
    .eq('id', fileId)
    .eq('user_id', userId)
    .eq('source', 'minerva')
    .maybeSingle()
  if (!row?.r2_key) return { ok: false, error: 'File not found.' }
  const head = await headObject(row.r2_key)
  if (!head) return { ok: false, error: 'Bytes not in storage.' }
  const { error } = await admin
    .from('files')
    .update({ size_bytes: head.size, sort_status: 'pending' })
    .eq('id', fileId)
    .eq('user_id', userId)
  if (error) return { ok: false, error: error.message }
  after(async () => {
    await sortFile(admin, userId, fileId)
  })
  return { ok: true }
}
