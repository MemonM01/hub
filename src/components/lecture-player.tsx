'use client'

import { useMemo, useState } from 'react'

const PANOPTO = 'https://leeds.cloud.panopto.eu/Panopto/Pages/Embed.aspx'

function seconds(stamp: string) {
  return stamp.split(':').map(Number).reduce((a, b) => a * 60 + b, 0)
}

type Line = { at: number | null; stamp: string | null; text: string }

/** The Panopto video, and its transcript beside it: click a line to jump the video there. */
export function LecturePlayer({ sessionId, transcript }: { sessionId: string; transcript: string | null }) {
  const [start, setStart] = useState<{ at: number; n: number } | null>(null)
  const [q, setQ] = useState('')
  const lines: Line[] = useMemo(
    () =>
      (transcript ?? '').split('\n').map((l) => {
        const m = /^\[([\d:]+)\]\s*(.*)$/.exec(l)
        return m ? { at: seconds(m[1]), stamp: m[1], text: m[2] } : { at: null, stamp: null, text: l }
      }),
    [transcript],
  )
  const needle = q.trim().toLowerCase()
  const shown = needle ? lines.filter((l) => l.text.toLowerCase().includes(needle)) : lines

  const params = new URLSearchParams({
    id: sessionId,
    autoplay: start ? 'true' : 'false',
    offerviewer: 'true',
    showtitle: 'false',
    showbrand: 'false',
    captions: 'true',
    interactivity: 'all',
  })
  if (start) params.set('start', String(start.at))

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div>
        <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-[0_0_0_1px_var(--line)]">
          <iframe
            key={start?.n ?? 0}
            src={`${PANOPTO}?${params}`}
            title="Lecture video"
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Plays from Panopto with your own university login. If it asks you to sign in, sign in once in that box.
        </p>
      </div>

      <div className="flex min-h-0 flex-col rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)] lg:max-h-[calc(100dvh-10rem)]">
        <div className="border-b border-line p-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={transcript ? 'Search the transcript' : 'No transcript yet'}
            disabled={!transcript}
            className="field py-1.5 text-sm"
          />
        </div>
        {transcript ? (
          <ol className="min-h-0 flex-1 overflow-auto p-2 text-sm leading-relaxed">
            {shown.map((l, i) =>
              l.at != null ? (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setStart((s) => ({ at: l.at!, n: (s?.n ?? 0) + 1 }))}
                    className="flex w-full gap-3 rounded-md px-2 py-1 text-left hover:bg-paper"
                  >
                    <span className="w-12 shrink-0 pt-px text-xs tabular-nums text-muted">{l.stamp}</span>
                    <span>{l.text}</span>
                  </button>
                </li>
              ) : (
                <li key={i} className="px-2 py-1">
                  {l.text}
                </li>
              ),
            )}
            {!shown.length ? <li className="px-2 py-4 text-muted">No line mentions “{q}”.</li> : null}
          </ol>
        ) : (
          <p className="p-4 text-sm text-muted">
            Panopto has no captions for this recording yet. The Panopto sync picks them up as soon as they appear.
          </p>
        )}
      </div>
    </div>
  )
}
