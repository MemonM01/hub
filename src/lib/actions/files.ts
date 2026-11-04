'use server'

import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { MAX_UPLOAD_BYTES, deleteObject, headObject, objectKey, signPut } from '@/lib/r2'
import { mimeFor } from '@/lib/mime'

export type StartUpload =
  | { ok: true; fileId: string; url: string; contentType: string }
  | { ok: false; error: string }

/**
 * Step 1 of an upload: make (or reuse) the file row with a null size, and sign a PUT.
 * The size stays null until finishUpload has seen the bytes in R2.
 */
export async function startUpload(input: {
  filename: string
  size: number
  type: string
  moduleId?: string | null
  assignmentId?: string | null
  fileId?: string | null // fill in a row that only has a name
}): Promise<StartUpload> {
  const userId = await requireUserId()
  const filename = input.filename.trim().slice(0, 255)
  if (!filename) return { ok: false, error: 'That file has no name.' }
  if (!(input.size > 0)) return { ok: false, error: `${filename} is empty.` }
  if (input.size > MAX_UPLOAD_BYTES) return { ok: false, error: `${filename} is over 200 MB.` }
  const contentType = mimeFor(filename, input.type)
  const supabase = await createClient()

  let fileId = input.fileId ?? null
  if (fileId) {
    const { data: row } = await supabase.from('files').select('id').eq('id', fileId).maybeSingle()
    if (!row) return { ok: false, error: 'That file row does not exist.' }
  } else {
    let moduleId = input.moduleId ?? null
    let pinned = false
    if (input.assignmentId) {
      const { data: a } = await supabase
        .from('assignments')
        .select('id, module_id')
        .eq('id', input.assignmentId)
        .maybeSingle()
      if (!a) return { ok: false, error: 'That assignment does not exist.' }
      const { data: same } = await supabase
        .from('files')
        .select('id')
        .eq('assignment_id', a.id)
        .eq('filename', filename)
        .not('size_bytes', 'is', null)
        .limit(1)
      if (same?.length) return { ok: false, error: `${filename} is already there.` }
      moduleId = a.module_id
      pinned = true // dropped on this row by hand: the sorter never moves it
    }
    const { data: created, error } = await supabase
      .from('files')
      .insert({
        user_id: userId,
        filename,
        mime_type: contentType,
        module_id: moduleId,
        assignment_id: input.assignmentId ?? null,
        pinned,
        source: 'upload',
      })
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    fileId = created.id
  }

  const key = objectKey(userId, fileId!, filename)
  const { error: keyErr } = await supabase
    .from('files')
    .update({ r2_key: key, mime_type: contentType, ...(input.fileId ? { filename } : {}) })
    .eq('id', fileId!)
  if (keyErr) return { ok: false, error: keyErr.message }

  return { ok: true, fileId: fileId!, url: await signPut(key, contentType), contentType }
}

/** Step 2: confirm the bytes really arrived in R2, then record the real size. */
export async function finishUpload(fileId: string): Promise<{ ok: boolean; error?: string }> {
  await requireUserId()
  const supabase = await createClient()
  const { data: row } = await supabase.from('files').select('id, r2_key').eq('id', fileId).maybeSingle()
  if (!row?.r2_key) return { ok: false, error: 'File not found.' }

  const head = await headObject(row.r2_key)
  if (!head) return { ok: false, error: 'The upload did not reach storage.' }

  const { error } = await supabase
    .from('files')
    .update({ size_bytes: head.size, sort_status: 'pending' })
    .eq('id', fileId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/files')
  revalidatePath('/assignments')
  revalidatePath('/')
  return { ok: true }
}

/** Remove a row that was started but whose upload failed, so no empty row is left behind. */
export async function abandonUpload(fileId: string) {
  await requireUserId()
  const supabase = await createClient()
  await supabase.from('files').delete().eq('id', fileId).is('size_bytes', null).eq('source', 'upload')
}

export async function deleteFile(fileId: string): Promise<{ ok: boolean; error?: string }> {
  await requireUserId()
  const supabase = await createClient()
  const { data: row } = await supabase.from('files').select('id, r2_key, thumbnail_key').eq('id', fileId).maybeSingle()
  if (!row) return { ok: false, error: 'File not found.' }
  if (row.r2_key) await deleteObject(row.r2_key)
  if (row.thumbnail_key) await deleteObject(row.thumbnail_key)
  const { error } = await supabase.from('files').delete().eq('id', fileId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/files')
  revalidatePath('/assignments')
  revalidatePath('/')
  return { ok: true }
}
