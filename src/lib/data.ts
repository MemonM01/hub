import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { DONE, type Assignment, type Module } from '@/lib/types'

export async function getModules(opts: { includeArchived?: boolean } = {}): Promise<Module[]> {
  const supabase = await createClient()
  let q = supabase.from('modules').select('id, code, name, archived').order('code')
  if (!opts.includeArchived) q = q.eq('archived', false)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data as Module[]
}

export async function getAssignments(): Promise<Assignment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assignments')
    .select('id, module_id, sheet, title, is_quiz, status, due_at')
  if (error) throw new Error(error.message)
  return data as Assignment[]
}

/** Done = submitted or graded. Cancelled rows don't count either way. */
export function progressFor(moduleId: string, assignments: Assignment[]) {
  const live = assignments.filter((a) => a.module_id === moduleId && a.status !== 'cancelled')
  return { done: live.filter((a) => DONE.includes(a.status)).length, total: live.length }
}
