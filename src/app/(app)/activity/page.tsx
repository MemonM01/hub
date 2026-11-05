import type { Metadata } from 'next'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/format'
import { UndoButton } from '@/components/learning-editor'

export const instant = false
export const metadata: Metadata = { title: 'Activity' }

type Row = {
  id: string
  actor: string
  entity: string
  action: string
  before: { content?: string } | null
  after: { content?: string } | null
  undone_at: string | null
  created_at: string
}

/** A short line-level diff: lines removed and added. */
function diff(a: string, b: string) {
  const A = a.split('\n')
  const B = b.split('\n')
  const setA = new Set(A)
  const setB = new Set(B)
  return { removed: A.filter((l) => l.trim() && !setB.has(l)), added: B.filter((l) => l.trim() && !setA.has(l)) }
}

export default async function ActivityPage() {
  await requireUserId()
  const supabase = await createClient()
  const { data } = await supabase
    .from('activity')
    .select('id, actor, entity, action, before, after, undone_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  const rows = (data ?? []) as Row[]
  return (
    <section className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      {!rows.length ? <p className="text-sm text-muted">No changes yet. Edits to the learning profile show up here.</p> : null}
      <ul className="space-y-3">
        {rows.map((r) => {
          const d = diff(r.before?.content ?? '', r.after?.content ?? '')
          const who = r.actor === 'me' ? 'You' : r.actor.replace(/^mcp:/, '')
          return (
            <li key={r.id} className={`rounded-lg border border-line p-3 ${r.undone_at ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{who}</span>
                <span className="text-muted">{r.action}</span>
                <span className="text-xs text-muted">{formatDateTime(r.created_at)}</span>
                <span className="ml-auto">
                  {r.undone_at ? <span className="text-xs text-muted">Undone</span> : r.entity === 'learning_profile' ? <UndoButton id={r.id} /> : null}
                </span>
              </div>
              {d.removed.length || d.added.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted">
                    {d.added.length} line(s) added, {d.removed.length} removed
                  </summary>
                  <pre className="mt-2 overflow-auto rounded bg-line/40 p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {d.removed.map((l, i) => (
                      <span key={'r' + i} className="block text-danger">
                        − {l}
                      </span>
                    ))}
                    {d.added.map((l, i) => (
                      <span key={'a' + i} className="block text-accent">
                        + {l}
                      </span>
                    ))}
                  </pre>
                </details>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
