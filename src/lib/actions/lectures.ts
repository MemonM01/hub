'use server'

import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

function refresh() {
  revalidatePath('/lectures')
  revalidatePath('/')
}

/** Match a Panopto folder to a module once. Its recordings, now and later, are filed under it. */
export async function matchFolder(folderId: string, moduleId: string | null) {
  await requireUserId()
  const supabase = await createClient()
  const { error } = await supabase.from('panopto_folders').update({ module_id: moduleId }).eq('id', folderId)
  if (error) throw new Error(error.message)
  const { error: lErr } = await supabase.from('lectures').update({ module_id: moduleId }).eq('folder_id', folderId)
  if (lErr) throw new Error(lErr.message)
  refresh()
}

/** Archived folders are skipped by the sync. */
export async function setFolderArchived(folderId: string, archived: boolean) {
  await requireUserId()
  const supabase = await createClient()
  const { error } = await supabase.from('panopto_folders').update({ archived }).eq('id', folderId)
  if (error) throw new Error(error.message)
  refresh()
}

export async function setWatched(lectureId: string, watched: boolean) {
  const userId = await requireUserId()
  const supabase = await createClient()
  const { data: prev } = await supabase.from('lecture_progress').select('percent').eq('lecture_id', lectureId).maybeSingle()
  const { error } = await supabase
    .from('lecture_progress')
    .upsert({ lecture_id: lectureId, user_id: userId, watched, percent: watched ? 100 : (prev?.percent ?? 0) })
  if (error) throw new Error(error.message)
  refresh()
  revalidatePath(`/lectures/${lectureId}`)
}
