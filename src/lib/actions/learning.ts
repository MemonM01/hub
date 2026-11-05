'use server'

import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type SaveState = { ok?: string; error?: string }

function refresh() {
  revalidatePath('/learning')
  revalidatePath('/activity')
}

export async function saveProfile(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const userId = await requireUserId()
  const content = String(formData.get('content') ?? '').slice(0, 50_000)
  const supabase = await createClient()
  const { data: before } = await supabase.from('learning_profiles').select('content').maybeSingle()
  if ((before?.content ?? '') === content) return { ok: 'No changes.' }
  const { error } = await supabase.from('learning_profiles').upsert({ user_id: userId, content })
  if (error) return { error: error.message }
  await supabase.from('activity').insert({
    user_id: userId,
    actor: 'me',
    entity: 'learning_profile',
    entity_id: userId,
    action: 'Edited learning profile',
    before: { content: before?.content ?? '' },
    after: { content },
  })
  refresh()
  return { ok: 'Saved.' }
}

/** Put the learning profile back to what it was before one change. The undo is logged too. */
export async function undoActivity(id: string): Promise<SaveState> {
  const userId = await requireUserId()
  const supabase = await createClient()
  const { data: row } = await supabase.from('activity').select('id, entity, before, after, undone_at').eq('id', id).maybeSingle()
  if (!row) return { error: 'Not found.' }
  if (row.undone_at) return { error: 'Already undone.' }
  if (row.entity !== 'learning_profile') return { error: 'This kind of change cannot be undone here.' }
  const { data: now } = await supabase.from('learning_profiles').select('content').maybeSingle()
  const restore = (row.before as { content?: string } | null)?.content ?? ''
  const { error } = await supabase.from('learning_profiles').upsert({ user_id: userId, content: restore })
  if (error) return { error: error.message }
  await supabase.from('activity').update({ undone_at: new Date().toISOString() }).eq('id', id)
  await supabase.from('activity').insert({
    user_id: userId,
    actor: 'me',
    entity: 'learning_profile',
    entity_id: userId,
    action: 'Undid an earlier change',
    before: { content: now?.content ?? '' },
    after: { content: restore },
  })
  refresh()
  return { ok: 'Undone.' }
}
