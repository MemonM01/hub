import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/format'
import { lectureName } from '@/lib/lecture-name'
import { LecturePlayer } from '@/components/lecture-player'
import { WatchedToggle } from '@/components/lecture-controls'

export const instant = false

type Lecture = {
  id: string
  title: string
  panopto_session_id: string
  delivered_at: string | null
  duration_seconds: number | null
  viewer_url: string | null
  transcript: string | null
  modules: { code: string; name: string | null } | null
  lecture_progress: { watched: boolean; percent: number } | null
}

export default async function LecturePage({ params }: PageProps<'/lectures/[id]'>) {
  await requireUserId()
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('lectures')
    .select('id, title, panopto_session_id, delivered_at, duration_seconds, viewer_url, transcript, modules(code, name), lecture_progress(watched, percent)')
    .eq('id', id)
    .maybeSingle()
  if (!data) notFound()
  const l = data as unknown as Lecture
  const back = l.modules ? `/modules/${l.modules.code}/videos` : '/lectures'

  return (
    <article className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <Link href={back} prefetch={false} className="text-sm text-muted hover:text-ink">
            ← {l.modules ? `${l.modules.code} videos` : 'Lectures'}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{lectureName(l.title)}</h1>
          <p className="mt-1 text-sm text-muted">
            {[l.modules?.name, l.delivered_at ? formatDateTime(l.delivered_at) : null, l.duration_seconds ? `${Math.round(l.duration_seconds / 60)} min` : null]
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WatchedToggle lectureId={l.id} watched={!!l.lecture_progress?.watched} />
          {l.viewer_url ? (
            <a href={l.viewer_url} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink">
              Open in Panopto
            </a>
          ) : null}
        </div>
      </div>
      <LecturePlayer sessionId={l.panopto_session_id} transcript={l.transcript} />
    </article>
  )
}
