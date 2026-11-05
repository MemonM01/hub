'use server'

import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { MAX_ICS_BYTES, importIcs, timetableUrl } from '@/lib/timetable'

export type ImportState = { error?: string; ok?: string }

function message(r: Awaited<ReturnType<typeof importIcs>>) {
  const parts = [`Imported ${r.sessions} session(s)`, `${r.matched} matched to your modules`]
  if (r.removed) parts.push(`${r.removed} removed`)
  let msg = parts.join(', ') + '.'
  if (r.unmatchedCodes.length) msg += ` Not added as modules yet: ${r.unmatchedCodes.join(', ')}.`
  return msg
}

export async function importTimetableFile(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const userId = await requireUserId()
  const file = formData.get('file')
  if (!(file instanceof File) || !file.size) return { error: 'Choose your .ics file first.' }
  if (file.size > MAX_ICS_BYTES) return { error: 'That file is over 5 MB.' }
  try {
    const r = await importIcs(await createClient(), userId, await file.text())
    revalidatePath('/calendar')
    return { ok: message(r) }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function syncTimetableFromLink(): Promise<ImportState> {
  const userId = await requireUserId()
  const url = timetableUrl()
  if (!url) return { error: 'Set TIMETABLE_ICS_URL in Vercel to your MyTimetable link first.' }
  let text: string
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
    if (!res.ok) return { error: `MyTimetable answered ${res.status}.` }
    text = await res.text()
  } catch (e) {
    return { error: `Could not reach MyTimetable: ${(e as Error).message}` }
  }
  if (text.length > MAX_ICS_BYTES) return { error: 'The timetable feed is unexpectedly large.' }
  try {
    const r = await importIcs(await createClient(), userId, text)
    revalidatePath('/calendar')
    return { ok: message(r) }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
