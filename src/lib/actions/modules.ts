'use server'

import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { normaliseModuleCode } from '@/lib/sheets'

export type FormState = { error?: string; ok?: string }

export async function addModule(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId()
  const code = normaliseModuleCode(String(formData.get('code') ?? ''))
  if (!code) return { error: 'Use the code Minerva and Panopto use, like COMP2860.' }
  const name = String(formData.get('name') ?? '').trim() || null

  const supabase = await createClient()
  const { error } = await supabase.from('modules').insert({ user_id: userId, code, name })
  if (error?.code === '23505') return { error: `${code} is already added.` }
  if (error) return { error: error.message }

  revalidatePath('/modules')
  revalidatePath('/')
  return { ok: `Added ${code}.` }
}

export async function setModuleArchived(moduleId: string, archived: boolean) {
  await requireUserId()
  const supabase = await createClient()
  const { error } = await supabase.from('modules').update({ archived }).eq('id', moduleId)
  if (error) throw new Error(error.message)
  revalidatePath('/modules')
  revalidatePath('/')
}
