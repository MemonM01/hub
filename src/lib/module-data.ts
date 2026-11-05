import 'server-only'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normaliseModuleCode } from '@/lib/sheets'
import type { Assignment, FileRow, Module } from '@/lib/types'

export type LectureRow = {
  id: string
  title: string
  delivered_at: string | null
  duration_seconds: number | null
  lecture_progress: { watched: boolean; percent: number } | null
}

export async function getModuleBundle(rawCode: string) {
  const code = normaliseModuleCode(decodeURIComponent(rawCode))
  if (!code) notFound()
  const supabase = await createClient()

  const { data: mod } = await supabase
    .from('modules')
    .select('id, code, name, archived, topics')
    .eq('code', code)
    .maybeSingle()
  if (!mod) notFound()

  const [files, lectures, assignments] = await Promise.all([
    supabase
      .from('files')
      .select('id, module_id, assignment_id, filename, title, kind, size_bytes, sort_status, created_at, week, topic, source_url')
      .eq('module_id', mod.id)
      .not('size_bytes', 'is', null) // a name without bytes is not a file
      .order('created_at', { ascending: false }),
    supabase
      .from('lectures')
      .select('id, title, delivered_at, duration_seconds, lecture_progress(watched, percent)')
      .eq('module_id', mod.id)
      .order('delivered_at', { ascending: false }),
    supabase
      .from('assignments')
      .select('id, module_id, sheet, title, is_quiz, status, due_at')
      .eq('module_id', mod.id),
  ])

  return {
    module: mod as Module & { topics: string[] },
    files: (files.data ?? []) as (FileRow & { week: number | null; topic: string | null; source_url: string | null })[],
    lectures: (lectures.data ?? []) as unknown as LectureRow[],
    assignments: (assignments.data ?? []) as Assignment[],
  }
}
