'use server'

import { revalidatePath } from 'next/cache'
import { TZDate } from '@date-fns/tz'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { assignmentExternalId, normaliseSheet } from '@/lib/sheets'
import { STATUSES, type Status } from '@/lib/types'
import { TZ } from '@/lib/format'
import type { FormState } from './modules'

// '2026-11-10T17:00' typed in Leeds time -> ISO string.
function londonToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value)
  if (!m) return null
  const [, y, mo, d, h = '23', mi = '59'] = m
  return new TZDate(+y, +mo - 1, +d, +h, +mi, TZ).toISOString()
}

export async function addAssignment(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId()
  const moduleId = String(formData.get('module_id') ?? '')
  const sheet = normaliseSheet(String(formData.get('sheet') ?? ''))
  if (!moduleId) return { error: 'Pick a module.' }
  if (!sheet) return { error: 'Sheet number looks like 1.2.' }
  const title = String(formData.get('title') ?? '').trim() || null
  const isQuiz = formData.get('is_quiz') === 'on'
  const dueRaw = String(formData.get('due_at') ?? '').trim()
  const dueAt = dueRaw ? londonToIso(dueRaw) : null
  if (dueRaw && !dueAt) return { error: 'That due date did not make sense.' }

  const supabase = await createClient()
  const { data: mod } = await supabase.from('modules').select('id, code').eq('id', moduleId).maybeSingle()
  if (!mod) return { error: 'That module does not exist.' }

  const { error } = await supabase.from('assignments').insert({
    user_id: userId,
    module_id: mod.id,
    sheet,
    title,
    is_quiz: isQuiz,
    due_at: dueAt,
    external_id: assignmentExternalId(mod.id, sheet),
  })
  if (error?.code === '23505') return { error: `${mod.code} sheet ${sheet} already exists.` }
  if (error) return { error: error.message }

  revalidatePath('/assignments')
  revalidatePath('/')
  return { ok: `Added ${mod.code} sheet ${sheet}${isQuiz ? ' (quiz)' : ''}.` }
}

export async function setAssignmentStatus(id: string, status: Status) {
  await requireUserId()
  if (!STATUSES.includes(status)) throw new Error('Unknown status')
  const supabase = await createClient()
  const { error } = await supabase.from('assignments').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/assignments')
  revalidatePath('/')
}
