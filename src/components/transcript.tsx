'use client'

import { useMemo, useState } from 'react'

export function Transcript({ text }: { text: string }) {
  const [q, setQ] = useState('')
  const lines = useMemo(() => text.split('\n'), [text])
  const needle = q.trim().toLowerCase()
  const hits = useMemo(() => {
    if (!needle) return null
    const out: number[] = []
    lines.forEach((l, i) => l.toLowerCase().includes(needle) && out.push(i))
    return out
  }, [lines, needle])

  // Show each hit with two lines either side.
  const shown = useMemo(() => {
    if (!hits) return lines.map((_, i) => i)
    const keep = new Set<number>()
    for (const i of hits) for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) keep.add(j)
    return [...keep].sort((a, b) => a - b)
  }, [hits, lines])

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the transcript"
          className="field max-w-xs"
        />
        {hits ? <span className="text-xs text-muted">{hits.length} match(es)</span> : null}
      </div>
      <div className="max-h-[70dvh] overflow-auto rounded-lg border border-line p-4 text-sm leading-relaxed">
        {shown.map((i, n) => {
          const gap = n > 0 && i !== shown[n - 1] + 1
          const m = /^\[([\d:]+)\]\s*(.*)$/.exec(lines[i])
          return (
            <div key={i}>
              {gap ? <div className="my-2 border-t border-dashed border-line" /> : null}
              <p className={hits?.includes(i) ? 'bg-accent/10' : ''}>
                {m ? <span className="mr-2 font-mono text-xs text-muted">{m[1]}</span> : null}
                {m ? m[2] : lines[i]}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
