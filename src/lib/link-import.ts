import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { objectKey, putBytes } from '@/lib/r2'
import { mimeFor } from '@/lib/mime'

const MAX_BYTES = 25 * 1024 * 1024
const MAX_FILES = 60
const FILE_EXT = /\.(pdf|html?|pptx|docx|ipynb|py|txt|md|zip)$/i

/** Only public https pages, never this machine or a private network. */
export function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'https:') return null
    const h = u.hostname
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return null
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) return null // no IP literals
    u.hash = ''
    return u
  } catch {
    return null
  }
}

function decode(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

/** Links on a listing page that point at files in the same folder or below it. */
export function fileLinks(html: string, page: URL): { url: URL; text: string }[] {
  const base = page.href.endsWith('/') ? page.href : page.href.replace(/[^/]*$/, '')
  const out: { url: URL; text: string }[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u: URL
    try {
      u = new URL(decode(m[1]), page)
    } catch {
      continue
    }
    u.hash = ''
    if (u.origin !== page.origin || !u.href.startsWith(base) || u.href === page.href) continue
    if (!FILE_EXT.test(u.pathname)) continue
    if (seen.has(u.href)) continue
    seen.add(u.href)
    const text = decode(m[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
    out.push({ url: u, text })
    if (out.length >= MAX_FILES) break
  }
  return out
}

async function fetchCapped(url: URL) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'hub (personal study dashboard)' } })
  if (!res.ok) throw new Error(`${url.pathname} answered ${res.status}`)
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_BYTES) throw new Error(`${url.pathname} is over 25 MB`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > MAX_BYTES) throw new Error(`${url.pathname} is over 25 MB`)
  return { bytes, type: res.headers.get('content-type') ?? '' }
}

/**
 * Save files from a link: a page that lists slides (every linked file in that folder),
 * or a single file. Each keeps its source URL, so adding the same link again skips it.
 */
export async function importFromLink(
  db: SupabaseClient,
  userId: string,
  input: { url: string; moduleId: string; topic: string | null },
) {
  const page = safeUrl(input.url)
  if (!page) throw new Error('Use a public https link.')
  const first = await fetchCapped(page)
  const isHtml = /text\/html/i.test(first.type) || /\.html?$/i.test(page.pathname) || page.pathname.endsWith('/')
  let targets: { url: URL; text: string }[] = []
  if (isHtml) targets = fileLinks(new TextDecoder().decode(first.bytes), page)
  const single = !targets.length
  if (single) targets = [{ url: page, text: '' }]

  const { data: existing } = await db
    .from('files')
    .select('source_url')
    .eq('user_id', userId)
    .in('source_url', targets.map((t) => t.url.href))
  const have = new Set((existing ?? []).map((r) => r.source_url))

  const added: string[] = []
  const failed: string[] = []
  for (const t of targets) {
    if (have.has(t.url.href)) continue
    try {
      const { bytes, type } = single ? first : await fetchCapped(t.url)
      const filename = decodeURIComponent(t.url.pathname.split('/').filter(Boolean).pop() || 'page.html').slice(0, 200)
      const mime = mimeFor(filename, type.split(';')[0] || null)
      const title = t.text.replace(/^[\w.-]+\.(html?|pdf)\s*:\s*/i, '').slice(0, 300) || null
      const { data: row, error } = await db
        .from('files')
        .insert({
          user_id: userId,
          filename,
          title,
          mime_type: mime,
          module_id: input.moduleId,
          topic: input.topic,
          source: 'link',
          source_url: t.url.href,
          kind: /slides?/i.test(t.url.pathname) ? 'lecture_slides' : null,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      const key = objectKey(userId, row.id, filename)
      await putBytes(key, bytes, mime)
      await db.from('files').update({ r2_key: key, size_bytes: bytes.length, sort_status: 'pending' }).eq('id', row.id).eq('user_id', userId)
      added.push(row.id)
    } catch (e) {
      failed.push(`${t.url.pathname.split('/').pop()}: ${(e as Error).message}`)
    }
  }
  return { added, skipped: targets.length - added.length - failed.length, failed }
}
