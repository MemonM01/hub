import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/format'
import { Transcript } from '@/components/transcript'
import { WatchedToggle } from '@/components/lecture-controls'

export const instant = false

type Lecture = {
  id: string
  title: string
  delivered_at: string | null
  duration_seconds: number | null
  viewer_url: string | null
  thumbnail_url: string | null
  transcript: string | null
  modules: { code: string; name: string | null } | null
  panopto_folders: { name: string } | null
  lecture_progress: { watched: boolean; percent: number } | null
}

export default async function LecturePage({ params }: PageProps<'/lectures/[id]'>) {
  await requireUserId()
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('lectures')
    .select(
      'id, title, delivered_at, duration_seconds, viewer_url, thumbnail_url, transcript, modules(code, name), panopto_folders(name), lecture_progress(watched, percent)',
    )
    .eq('id', id)
    .maybeSingle()
  if (!data) notFound()
  const l = data as unknown as Lecture
  const pct = l.lecture_progress?.percent

  return (
    <article className="space-y-5">
      <div>
        <Link href={l.modules ? `/modules/${l.modules.code}/videos` : '/lectures'} prefetch={false} className="text-sm text-muted hover:text-ink">
          ← {l.modules ? `${l.modules.code} · Videos` : 'Lectures'}
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{l.title}</h1>
        <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
          {l.delivered_at ? <span>{formatDateTime(l.delivered_at)}</span> : null}
          {l.duration_seconds ? <span>{Math.round(l.duration_seconds / 60)} min</span> : null}
          {l.panopto_folders ? <span>{l.panopto_folders.name}</span> : null}
          {pct != null && !l.lecture_progress?.watched ? <span>{Math.round(pct)}% watched</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {l.viewer_url ? (
          <a href={l.viewer_url} target="_blank" rel="noreferrer" className="btn-primary">
            Watch on Panopto
          </a>
        ) : null}
        <WatchedToggle lectureId={l.id} watched={!!l.lecture_progress?.watched} />
      </div>
      {l.transcript ? (
        <Transcript text={l.transcript} />
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
          No transcript yet. Panopto may not have captions for this recording. The next sync picks one up if it appears.
        </p>
      )}
    </article>
  )
}
