import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import sharp from 'sharp'
import { getObjectBytes, putBytes } from '@/lib/r2'
import { extractText } from './extract'
import { assignmentExternalId, parseModuleCode, parseSheet } from '@/lib/sheets'
import { looksLikeSolution, looksLikeTemplate } from '@/lib/sheets-kind'

export const KINDS = [
  'lecture_slides',
  'lecture_notes',
  'coursework',
  'worksheet',
  'submission_template',
  'lab_sheet',
  'solution',
  'quiz',
  'reading',
  'other',
] as const
export type Kind = (typeof KINDS)[number]
const SHEET_KINDS: Kind[] = ['worksheet', 'submission_template', 'solution', 'lab_sheet', 'coursework', 'quiz']

// Below this the file waits under "Needs a look" instead of being filed.
export const CONFIDENCE_TO_FILE = 0.65
const MODEL = process.env.SORTER_MODEL || 'anthropic/claude-haiku-5.5'

const Verdict = z.object({
  summary: z.string().describe('Two or three plain sentences on what this file is and covers.'),
  moduleCode: z.string().nullable().describe('One of the given module codes, or null if unsure.'),
  week: z.number().int().min(1).max(30).nullable().describe('Teaching week if the file says or clearly implies it.'),
  kind: z.enum(KINDS),
  sheet: z
    .string()
    .nullable()
    .describe('Worksheet or exercise sheet number like 1.2, only if this is a sheet, its template, or its solutions.'),
  confidence: z.number().min(0).max(1).describe('How sure you are about module and kind together.'),
})
type Verdict = z.infer<typeof Verdict>

type FileRow = {
  id: string
  user_id: string
  filename: string
  title: string | null
  mime_type: string | null
  size_bytes: number | null
  r2_key: string | null
  module_id: string | null
  assignment_id: string | null
  week: number | null
  pinned: boolean
  source: string
}

function guessKind(filename: string): Kind | null {
  if (looksLikeSolution(filename)) return 'solution'
  if (looksLikeTemplate(filename)) return 'submission_template'
  if (/(?<![A-Za-z])(lab)(?![A-Za-z])/i.test(filename)) return 'lab_sheet'
  if (/(?<![A-Za-z])(lecture|slides?)(?![A-Za-z])/i.test(filename)) return 'lecture_slides'
  if (parseSheet(filename)) return 'worksheet'
  if (/(?<![A-Za-z])(coursework|cw\d|assignment)(?![A-Za-z])/i.test(filename)) return 'coursework'
  return null
}

async function askModel(file: FileRow, text: string | null, modules: { code: string; name: string | null }[]) {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) return null
  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: Verdict }),
    system:
      'You file a University of Leeds student\'s course files. Be accurate. If the text does not support an answer, use null and a lower confidence. Never invent a module code that is not in the list.',
    prompt: [
      `Modules: ${modules.map((m) => `${m.code}${m.name ? ` (${m.name})` : ''}`).join(', ')}`,
      `Filename: ${file.filename}`,
      file.title ? `Title on Minerva: ${file.title}` : '',
      file.week ? `Minerva folder suggests week ${file.week}` : '',
      'Kinds: lecture_slides, lecture_notes, coursework (assessed), worksheet (exercise sheet), submission_template, lab_sheet, solution, quiz, reading, other.',
      text ? `Text (start of file):\n${text.slice(0, 12000)}` : 'No text could be read from this file.',
    ]
      .filter(Boolean)
      .join('\n\n'),
  })
  return output as Verdict
}

async function thumbnail(file: FileRow, bytes: Uint8Array) {
  if (!file.mime_type?.startsWith('image/') || file.mime_type === 'image/svg+xml' || !file.r2_key) return null
  const webp = await sharp(bytes).rotate().resize(320, 320, { fit: 'inside' }).webp({ quality: 70 }).toBuffer()
  const key = `${file.r2_key}.thumb.webp`
  await putBytes(key, new Uint8Array(webp), 'image/webp')
  return key
}

/**
 * Read a real file, extract its text, summarise it, and file it by module, week, kind and assignment.
 * Pass a client that can see the row (session client, or admin after a token check). user_id is
 * always set explicitly. Name-only rows (no bytes) are skipped. Pinned rows are never moved.
 */
export async function sortFile(db: SupabaseClient, userId: string, fileId: string) {
  const { data } = await db
    .from('files')
    .select('id, user_id, filename, title, mime_type, size_bytes, r2_key, module_id, assignment_id, week, pinned, source')
    .eq('id', fileId)
    .eq('user_id', userId)
    .maybeSingle()
  const file = data as FileRow | null
  if (!file || file.size_bytes == null || !file.r2_key) return { skipped: true }

  try {
    const { data: mods } = await db.from('modules').select('id, code, name').eq('user_id', userId)
    const modules = mods ?? []
    const byCode = new Map(modules.map((m) => [m.code, m.id]))
    const codeOf = new Map(modules.map((m) => [m.id, m.code]))

    const bytes = await getObjectBytes(file.r2_key, 60 * 1024 * 1024)
    const text = await extractText(bytes, file.filename, file.mime_type).catch(() => null)
    const thumb = await thumbnail(file, bytes).catch(() => null)

    let verdict: Verdict | null = null
    let sortError: string | null = null
    try {
      verdict = await askModel(file, text, modules)
      if (!verdict) sortError = 'AI_GATEWAY_API_KEY is not set on the server.'
    } catch (e) {
      verdict = null // fall back to filename rules below
      sortError = ((e as Error).message || String(e)).slice(0, 500)
    }

    // Filename rules are reliable for these, so they win over the model.
    const nameCode = parseModuleCode(file.filename)
    const nameKind = guessKind(file.filename)
    const nameSheet = parseSheet(file.filename)

    const knownModule = file.module_id ? codeOf.get(file.module_id) : null // Minerva course or set by hand
    const modelCode = verdict?.moduleCode && byCode.has(verdict.moduleCode) ? verdict.moduleCode : null
    const moduleCode = knownModule ?? (nameCode && byCode.has(nameCode) ? nameCode : modelCode)
    const kind: Kind = nameKind ?? verdict?.kind ?? 'other'
    const sheet = SHEET_KINDS.includes(kind) ? (nameSheet ?? verdict?.sheet ?? null) : null
    const week = file.week ?? verdict?.week ?? null

    let confidence = verdict?.confidence ?? (moduleCode && nameKind ? 0.7 : 0.3)
    if (knownModule || nameCode) confidence = Math.max(confidence, 0.7)
    if (!moduleCode) confidence = Math.min(confidence, 0.4)
    const file_it = confidence >= CONFIDENCE_TO_FILE

    const update: Record<string, unknown> = {
      extracted_text: text,
      summary: verdict?.summary ?? null,
      sort_confidence: confidence,
      thumbnail_key: thumb,
      sort_error: sortError,
      sort_status: file_it || file.pinned ? 'sorted' : 'needs_look',
    }

    if (file_it && !file.pinned) {
      const moduleId = byCode.get(moduleCode!)!
      update.module_id = moduleId
      update.kind = kind
      update.week = week
      if (sheet) {
        const ext = assignmentExternalId(moduleId, sheet)
        let { data: a } = await db
          .from('assignments')
          .select('id')
          .eq('user_id', userId)
          .eq('module_id', moduleId)
          .eq('sheet', sheet)
          .maybeSingle()
        // A solutions file alone never creates an assignment.
        if (!a && kind !== 'solution') {
          const created = await db
            .from('assignments')
            .upsert(
              { user_id: userId, module_id: moduleId, sheet, external_id: ext, is_quiz: kind === 'quiz' },
              { onConflict: 'user_id,external_id' },
            )
            .select('id')
            .single()
          a = created.data
        }
        if (a) update.assignment_id = a.id
      }
    } else if (!file.pinned) {
      update.kind = file_it ? kind : (nameKind ?? verdict?.kind ?? null)
    }

    const { error } = await db.from('files').update(update).eq('id', file.id).eq('user_id', userId)
    if (error) throw new Error(error.message)
    return { sorted: update.sort_status === 'sorted', confidence }
  } catch (e) {
    await db
      .from('files')
      .update({ sort_status: 'failed', sort_error: ((e as Error).message || String(e)).slice(0, 500) })
      .eq('id', file.id)
      .eq('user_id', userId)
    return { failed: true, error: (e as Error).message }
  }
}
