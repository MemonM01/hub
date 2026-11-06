import Link from 'next/link'
import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { TZ } from '@/lib/format'
import { lectureName } from '@/lib/lecture-name'

export type TileLecture = {
  id: string
  title: string
  delivered_at: string | null
  duration_seconds: number | null
  thumbnail_key?: string | null
  lecture_progress: { watched: boolean; percent: number } | null
}

function length(s: number | null) {
  if (!s) return null
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`
}

/** A video card: preview image (or a module-coloured cover), length, and how far I got. */
export function LectureTile({ l, code, color, from }: { l: TileLecture; code?: string | null; color?: string; from?: string }) {
  const watched = !!l.lecture_progress?.watched
  const percent = watched ? 100 : Math.round(l.lecture_progress?.percent ?? 0)
  const name = lectureName(l.title)
  const day = l.delivered_at ? format(new TZDate(l.delivered_at, TZ), 'EEE d MMM') : null
  const tint = color ?? '#687076'
  const href = `/lectures/${l.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`

  return (
    <Link href={href} prefetch={false} className="group block">
      <div
        className="relative aspect-video overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)]"
        style={{ background: `linear-gradient(135deg, ${tint}, color-mix(in srgb, ${tint} 45%, #0b0d0f))` }}
      >
        {l.thumbnail_key ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/thumbs/lecture/${l.id}`}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col justify-end p-3 text-white">
            {code ? <span className="text-xs font-semibold opacity-80">{code}</span> : null}
            <span className="text-lg font-semibold leading-tight">{day ?? 'Recording'}</span>
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        </span>
        {length(l.duration_seconds) ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {length(l.duration_seconds)}
          </span>
        ) : null}
        {watched ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
            ✓ Watched
          </span>
        ) : null}
        {percent > 0 ? (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
            <span className="block h-full" style={{ width: `${percent}%`, background: tint }} />
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-start gap-2">
        {code ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: tint }} aria-hidden="true" /> : null}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium group-hover:underline">{name}</div>
          <div className="text-xs text-muted">{[code, day].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
    </Link>
  )
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3 xl:grid-cols-4">{children}</ul>
}
