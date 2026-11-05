'use server'

import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { sortFile, KINDS, type Kind } from '@/lib/sorter'
import { assignmentExternalId, normaliseSheet } from '@/lib/sheets'

function refresh(fileId?: string) {
  revalidatePath('/files')
  revalidatePath('/assignments')
  revalidatePath('/')
  if (fileId) revalidatePath(`/files/${fileId}`)
}

/** Sort a few waiting files. The Files page calls this in a loop until nothing is left. */
export async function sortSome(): Promise<{ done: number; left: number }> {
  const userId = await requireUserId()
  const supabase = await createClient()
  const { data } = await supabase
    .from('files')
    .select('id')
    .in('sort_status', ['pending'])
    .not('size_bytes', 'is', null)
    .order('created_at')
    .limit(3)
  for (const f of data ?? []) await sortFile(supabase, userId, f.id)
  const { count } = await supabase
    .from('files')
    .select('id', { count: 'exact', head: true })
    .eq('sort_status', 'pending')
    .not('size_bytes', 'is', null)
  refresh()
  return { done: data?.length ?? 0, left: count ?? 0 }
}

/** Put every unpinned real file back in the queue. */
export async function resortAll() {
  await requireUserId()
  const supabase = await createClient()
  await supabase.from('files').update({ sort_status: 'pending' }).eq('pinned', false).not('size_bytes', 'is', null)
  refresh()
}

export async function resortFile(fileId: string) {
  const userId = await requireUserId()
  const supabase = await createClient()
  await sortFile(supabase, userId, fileId)
  refresh(fileId)
}

/** Filed by hand: pinned, so the sorter never moves it again. */
export async function fileManually(
  fileId: string,
  input: { moduleId: string | null; week: number | null; kind: string | null; sheet: string | null },
): Promise<{ error?: string }> {
  const userId = await requireUserId()
  const supabase = await createClient()
  const kind = input.kind && (KINDS as readonly string[]).includes(input.kind) ? (input.kind as Kind) : null
  const sheet = input.sheet ? normaliseSheet(input.sheet) : null
  if (input.sheet && !sheet) return { error: 'Sheet looks like 1.2.' }
  let assignmentId: string | null = null
  if (sheet && input.moduleId) {
    const { data: a } = await supabase
      .from('assignments')
      .select('id')
      .eq('module_id', input.moduleId)
      .eq('sheet', sheet)
      .maybeSingle()
    if (a) assignmentId = a.id
    else if (kind !== 'solution') {
      const { data: created, error } = await supabase
        .from('assignments')
        .insert({ user_id: userId, module_id: input.moduleId, sheet, external_id: assignmentExternalId(input.moduleId, sheet) })
        .select('id')
        .single()
      if (error) return { error: error.message }
      assignmentId = created.id
    }
  }
  const { error } = await supabase
    .from('files')
    .update({
      module_id: input.moduleId,
      week: input.week,
      kind,
      assignment_id: assignmentId,
      pinned: true,
      sort_status: 'sorted',
    })
    .eq('id', fileId)
  if (error) return { error: error.message }
  refresh(fileId)
  return {}
}
