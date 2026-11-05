'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { importFromLink } from '@/lib/link-import'
import { sortFile } from '@/lib/sorter'

export type LinkState = { ok?: string; error?: string }

export async function addFromLink(_prev: LinkState, formData: FormData): Promise<LinkState> {
  const userId = await requireUserId()
  const moduleId = String(formData.get('module_id') ?? '')
  const url = String(formData.get('url') ?? '')
  const topic = String(formData.get('topic') ?? '').trim().slice(0, 80) || null
  const code = String(formData.get('code') ?? '')
  if (!moduleId || !url) return { error: 'Paste a link first.' }
  try {
    const r = await importFromLink(await createClient(), userId, { url, moduleId, topic })
    // Summarise them in the background, spaced out for the free AI rate limit.
    if (r.added.length) {
      after(async () => {
        const admin = createAdminClient()
        for (const [i, id] of r.added.slice(0, 12).entries()) {
          if (i) await new Promise((res) => setTimeout(res, 13000))
          await sortFile(admin, userId, id)
        }
      })
    }
    revalidatePath(`/modules/${code}`)
    revalidatePath('/files')
    const parts = [`Added ${r.added.length} file(s)`]
    if (r.skipped) parts.push(`${r.skipped} already here`)
    let msg = parts.join(', ') + '.'
    if (r.failed.length) msg += ` Could not add: ${r.failed.slice(0, 3).join('; ')}`
    return r.added.length || r.skipped ? { ok: msg } : { error: msg }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function setTopics(moduleId: string, code: string, topics: string[]) {
  await requireUserId()
  const clean = [...new Set(topics.map((t) => t.trim()).filter(Boolean))].slice(0, 20)
  const supabase = await createClient()
  const { error } = await supabase.from('modules').update({ topics: clean }).eq('id', moduleId)
  if (error) throw new Error(error.message)
  revalidatePath(`/modules/${code}`)
}

export async function setFileTopic(fileId: string, topic: string | null) {
  await requireUserId()
  const supabase = await createClient()
  const { error } = await supabase.from('files').update({ topic: topic?.trim() || null }).eq('id', fileId)
  if (error) throw new Error(error.message)
  revalidatePath(`/files/${fileId}`)
}
