/**
 * Return the parts of a long text around a query instead of the whole thing.
 * No query: the start of the text. Always says how long the full text is.
 */
export function windowed(text: string | null, query?: string | null, opts: { size?: number; radius?: number; max?: number } = {}) {
  const size = opts.size ?? 4000
  const radius = opts.radius ?? 700
  const max = opts.max ?? 6
  if (!text) return { total_chars: 0, windows: [] as { from: number; to: number; text: string }[], note: 'No text stored.' }
  const total = text.length
  const q = query?.trim()
  if (!q) {
    return {
      total_chars: total,
      windows: [{ from: 0, to: Math.min(total, size), text: text.slice(0, size) }],
      note: total > size ? 'Start of the text only. Pass a query to get the parts around it.' : undefined,
    }
  }
  const lower = text.toLowerCase()
  const terms = [q.toLowerCase(), ...q.toLowerCase().split(/\s+/).filter((t) => t.length > 3)]
  const hits: number[] = []
  for (const term of terms) {
    let i = lower.indexOf(term)
    while (i !== -1 && hits.length < 200) {
      hits.push(i)
      i = lower.indexOf(term, i + term.length)
    }
    if (hits.length && term === terms[0]) break // exact phrase found: prefer it
  }
  hits.sort((a, b) => a - b)
  const ranges: [number, number][] = []
  for (const h of hits) {
    const a = Math.max(0, h - radius)
    const b = Math.min(total, h + radius)
    const last = ranges[ranges.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else ranges.push([a, b])
    if (ranges.length >= max) break
  }
  if (!ranges.length) {
    return { total_chars: total, windows: [], note: `"${q}" does not appear in this text. Try another word, or no query for the start.` }
  }
  return { total_chars: total, windows: ranges.map(([a, b]) => ({ from: a, to: b, text: text.slice(a, b) })) }
}
