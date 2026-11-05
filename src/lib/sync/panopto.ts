import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export const PANOPTO_ORIGIN = 'https://leeds.cloud.panopto.eu'

export type InFolder = { id: string; name: string }
export type InSession = {
  id: string
  title: string
  folderId: string | null
  folderName?: string | null
  durationSeconds?: number | null
  deliveredAt?: string | null
  viewerUrl?: string | null
  thumbnailUrl?: string | null
  transcript?: string | null
  percent?: number | null
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Only Panopto's own https URLs are stored, so nothing else can end up in an href. */
function panoptoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const u = new URL(value, PANOPTO_ORIGIN)
    return u.origin === PANOPTO_ORIGIN ? u.toString() : null
  } catch {
    return null
  }
}

function str(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

/** Panopto search highlights matches with HTML. Store plain text only. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const t = value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return t ? t.slice(0, max) : null
}

export function cleanFolders(input: unknown): InFolder[] {
  if (!Array.isArray(input)) return []
  return input
    .map((f) => ({ id: str(f?.id, 64), name: text(f?.name, 300) }))
    .filter((f): f is InFolder => !!f.id && GUID.test(f.id) && !!f.name)
    .slice(0, 2000)
}

export function cleanSessions(input: unknown): InSession[] {
  if (!Array.isArray(input)) return []
  const out: InSession[] = []
  for (const s of input.slice(0, 500)) {
    const id = str(s?.id, 64)
    const title = text(s?.title, 500)
    if (!id || !GUID.test(id) || !title) continue
    const folderId = str(s?.folderId, 64)
    const delivered = str(s?.deliveredAt, 40)
    const percent = typeof s?.percent === 'number' && isFinite(s.percent) ? Math.max(0, Math.min(100, s.percent)) : null
    out.push({
      id,
      title,
      folderId: folderId && GUID.test(folderId) ? folderId : null,
      folderName: text(s?.folderName, 300),
      durationSeconds: typeof s?.durationSeconds === 'number' && isFinite(s.durationSeconds) ? Math.round(s.durationSeconds) : null,
      deliveredAt: delivered && !isNaN(Date.parse(delivered)) ? new Date(delivered).toISOString() : null,
      viewerUrl: panoptoUrl(s?.viewerUrl),
      thumbnailUrl: panoptoUrl(s?.thumbnailUrl),
      transcript: typeof s?.transcript === 'string' && s.transcript.trim() ? s.transcript.slice(0, 2_000_000) : null,
      percent,
    })
  }
  return out
}

/** What the bookmarklet needs to target the next run. */
export async function panoptoState(admin: SupabaseClient, userId: string) {
  const [modules, folders, transcripts] = await Promise.all([
    admin.from('modules').select('id, code').eq('user_id', userId).eq('archived', false),
    admin.from('panopto_folders').select('panopto_id, name, archived, module_id').eq('user_id', userId),
    admin.from('lectures').select('panopto_session_id').eq('user_id', userId).not('transcript', 'is', null),
  ])
  const codeOf = new Map((modules.data ?? []).map((m) => [m.id, m.code]))
  return {
    moduleCodes: (modules.data ?? []).map((m) => m.code),
    folders: (folders.data ?? []).map((f) => ({
      id: f.panopto_id,
      name: f.name,
      archived: f.archived,
      moduleCode: f.module_id ? (codeOf.get(f.module_id) ?? null) : null,
    })),
    haveTranscripts: (transcripts.data ?? []).map((l) => l.panopto_session_id),
  }
}

/** Save a batch. Lectures and watch progress are written separately. */
export async function savePanopto(admin: SupabaseClient, userId: string, folders: InFolder[], sessions: InSession[]) {
  // Folders seen in this batch, from the folder list or from the sessions themselves.
  const seen = new Map<string, string>()
  for (const f of folders) seen.set(f.id, f.name)
  for (const s of sessions) if (s.folderId && s.folderName && !seen.has(s.folderId)) seen.set(s.folderId, s.folderName)

  if (seen.size) {
    const { data: existing } = await admin
      .from('panopto_folders')
      .select('panopto_id')
      .eq('user_id', userId)
      .in('panopto_id', [...seen.keys()])
    const known = new Set((existing ?? []).map((f) => f.panopto_id))
    const fresh = [...seen].filter(([id]) => !known.has(id)).map(([id, name]) => ({ user_id: userId, panopto_id: id, name }))
    if (fresh.length) {
      const { error } = await admin.from('panopto_folders').upsert(fresh, { onConflict: 'user_id,panopto_id', ignoreDuplicates: true })
      if (error) throw new Error(error.message)
    }
    // Keep names current without touching the module match or the archived flag.
    for (const [id, name] of seen) {
      if (known.has(id)) await admin.from('panopto_folders').update({ name }).eq('user_id', userId).eq('panopto_id', id).neq('name', name)
    }
  }

  const folderIds = [...new Set(sessions.map((s) => s.folderId).filter((x): x is string => !!x))]
  const { data: folderRows } = folderIds.length
    ? await admin.from('panopto_folders').select('id, panopto_id, module_id, archived').eq('user_id', userId).in('panopto_id', folderIds)
    : { data: [] as { id: string; panopto_id: string; module_id: string | null; archived: boolean }[] }
  const folderBy = new Map((folderRows ?? []).map((f) => [f.panopto_id, f]))

  // Archived folders are skipped entirely.
  const live = sessions.filter((s) => !s.folderId || !folderBy.get(s.folderId)?.archived)
  if (!live.length) return { saved: 0, created: 0, skippedArchived: sessions.length }

  const { data: existingLectures } = await admin
    .from('lectures')
    .select('id, panopto_session_id, module_id, transcript')
    .eq('user_id', userId)
    .in('panopto_session_id', live.map((s) => s.id))
  const before = new Map((existingLectures ?? []).map((l) => [l.panopto_session_id, l]))

  const rows = live.map((s) => {
    const prev = before.get(s.id)
    const folder = s.folderId ? folderBy.get(s.folderId) : undefined
    return {
      user_id: userId,
      panopto_session_id: s.id,
      title: s.title,
      folder_id: folder?.id ?? null,
      // A matched folder files the recording; otherwise keep whatever it had.
      module_id: folder?.module_id ?? prev?.module_id ?? null,
      duration_seconds: s.durationSeconds ?? null,
      delivered_at: s.deliveredAt ?? null,
      viewer_url: s.viewerUrl ?? null,
      thumbnail_url: s.thumbnailUrl ?? null,
      // A run without a transcript never wipes one we already have.
      transcript: s.transcript ?? prev?.transcript ?? null,
    }
  })
  const { data: saved, error } = await admin
    .from('lectures')
    .upsert(rows, { onConflict: 'user_id,panopto_session_id' })
    .select('id, panopto_session_id')
  if (error) throw new Error(error.message)

  // Watch progress lives in its own table, so refreshing it never touches the lecture.
  const idOf = new Map((saved ?? []).map((l) => [l.panopto_session_id, l.id]))
  const withPercent = live.filter((s) => s.percent != null && idOf.has(s.id))
  if (withPercent.length) {
    const ids = withPercent.map((s) => idOf.get(s.id)!)
    const { data: prog } = await admin.from('lecture_progress').select('lecture_id, watched').eq('user_id', userId).in('lecture_id', ids)
    const watchedBefore = new Map((prog ?? []).map((p) => [p.lecture_id, p.watched]))
    const progressRows = withPercent.map((s) => {
      const lectureId = idOf.get(s.id)!
      return {
        lecture_id: lectureId,
        user_id: userId,
        percent: s.percent!,
        watched: watchedBefore.get(lectureId) || s.percent! >= 90,
      }
    })
    const { error: pErr } = await admin.from('lecture_progress').upsert(progressRows, { onConflict: 'lecture_id' })
    if (pErr) throw new Error(pErr.message)
  }

  return { saved: rows.length, created: rows.filter((r) => !before.has(r.panopto_session_id)).length, skippedArchived: sessions.length - live.length }
}
