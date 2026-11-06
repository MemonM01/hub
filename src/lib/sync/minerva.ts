import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mimeFor } from '@/lib/mime'
import { objectKey, signPut } from '@/lib/r2'
import { assignmentExternalId, normaliseModuleCode, parseSheet } from '@/lib/sheets'
import { looksLikeSolution } from '@/lib/sheets-kind'

export const RELAY_MAX_BYTES = 4 * 1024 * 1024 // Vercel functions accept ~4.5 MB bodies

export type InFile = {
  externalId: string
  moduleCode: string
  filename: string
  title: string | null
  week: number | null
  sections: string[]
}

function str(v: unknown, max: number) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

export function cleanFiles(input: unknown): InFile[] {
  if (!Array.isArray(input)) return []
  const out: InFile[] = []
  for (const f of input.slice(0, 300)) {
    const externalId = str(f?.externalId, 300)
    const moduleCode = normaliseModuleCode(String(f?.moduleCode ?? ''))
    const filename = str(f?.filename, 255)
    if (!externalId?.startsWith('minerva:') || !moduleCode || !filename) continue
    const week = Number(f?.week)
    out.push({
      externalId,
      moduleCode,
      filename,
      title: str(f?.title, 300),
      week: Number.isInteger(week) && week > 0 && week < 60 ? week : null,
      sections: Array.isArray(f?.sections)
        ? f.sections.filter((x: unknown): x is string => typeof x === 'string').map((x: string) => x.slice(0, 120)).slice(0, 6)
        : [],
    })
  }
  return out
}

export async function minervaState(admin: SupabaseClient, userId: string) {
  const [modules, files] = await Promise.all([
    admin.from('modules').select('code').eq('user_id', userId).eq('archived', false),
    admin.from('files').select('external_id, size_bytes').eq('user_id', userId).eq('source', 'minerva'),
  ])
  return {
    moduleCodes: (modules.data ?? []).map((m) => m.code),
    // Already stored with bytes: the bookmarklet skips these entirely.
    complete: (files.data ?? []).filter((f) => f.size_bytes != null).map((f) => f.external_id),
  }
}

/**
 * Record Minerva files by external id. New rows have a null size: a name, not a file.
 * Returns signed PUTs for rows that still need bytes.
 */
export async function saveMinerva(admin: SupabaseClient, userId: string, files: InFile[]) {
  if (!files.length) return { recorded: 0, needBytes: [] as NeedBytes[] }
  const { data: modules } = await admin.from('modules').select('id, code, topics').eq('user_id', userId)
  const moduleId = new Map((modules ?? []).map((m) => [m.code, m.id]))
  const topicsOf = new Map((modules ?? []).map((m) => [m.code, (m.topics ?? []) as string[]]))
  const norm = (t: string) => t.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '')
  // The Minerva folder an item sits in ("Linear Algebra") becomes its topic when it is one of the module's topics.
  const topicFor = (f: InFile) => {
    const topics = topicsOf.get(f.moduleCode) ?? []
    for (const s of [...f.sections].reverse()) {
      const hit = topics.find((t) => norm(t) === norm(s))
      if (hit) return hit
    }
    return null
  }

  const rows = files
    .filter((f) => moduleId.has(f.moduleCode))
    .map((f) => ({
      user_id: userId,
      external_id: f.externalId,
      source: 'minerva',
      filename: f.filename,
      title: f.title,
      week: f.week,
      topic: topicFor(f),
      module_id: moduleId.get(f.moduleCode)!,
      mime_type: mimeFor(f.filename),
    }))
  if (rows.length) {
    const { error } = await admin.from('files').upsert(rows, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  }

  // One assignment per module and sheet, by stable external id. A solutions file alone never makes one.
  const sheets = new Map<string, { module_id: string; sheet: string }>()
  for (const f of files) {
    const mid = moduleId.get(f.moduleCode)
    const sheet = parseSheet(f.filename)
    if (!mid || !sheet || looksLikeSolution(f.filename)) continue
    sheets.set(assignmentExternalId(mid, sheet), { module_id: mid, sheet })
  }
  if (sheets.size) {
    const { error } = await admin.from('assignments').upsert(
      [...sheets].map(([external_id, a]) => ({ user_id: userId, external_id, ...a })),
      { onConflict: 'user_id,external_id', ignoreDuplicates: true },
    )
    // A hand-made row for the same module+sheet already exists: that one wins, nothing to do.
    if (error && error.code !== '23505') throw new Error(error.message)
  }

  const { data: saved } = await admin
    .from('files')
    .select('id, external_id, filename, mime_type, size_bytes, r2_key')
    .eq('user_id', userId)
    .in('external_id', files.map((f) => f.externalId))
  const needBytes: NeedBytes[] = []
  for (const row of saved ?? []) {
    if (row.size_bytes != null) continue
    const key = row.r2_key ?? objectKey(userId, row.id, row.filename)
    if (!row.r2_key) await admin.from('files').update({ r2_key: key }).eq('id', row.id).eq('user_id', userId)
    const contentType = row.mime_type ?? mimeFor(row.filename)
    needBytes.push({ externalId: row.external_id, fileId: row.id, contentType, putUrl: await signPut(key, contentType) })
  }
  return { recorded: rows.length, needBytes }
}

export type NeedBytes = { externalId: string; fileId: string; contentType: string; putUrl: string }
