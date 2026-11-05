import Link from 'next/link'
import type { Metadata } from 'next'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getModules } from '@/lib/data'
import { formatBytes, formatDate } from '@/lib/format'
import { Uploader } from '@/components/uploader'
import { SortBacklog } from '@/components/sort-controls'
import { KIND_LABEL } from '@/lib/types'
import { compareFiles } from '@/lib/order'

export const instant = false
export const metadata: Metadata = { title: 'Files' }

type Row = {
  id: string
  filename: string
  title: string | null
  kind: string | null
  module_id: string | null
  size_bytes: number
  sort_status: string
  created_at: string
  week: number | null
  summary: string | null
}

const BACK = encodeURIComponent('/files')

export default async function FilesPage({ searchParams }: PageProps<'/files'>) {
  await requireUserId()
  const sp = await searchParams
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 200) ?? ''
  const supabase = await createClient()
  let filesQuery = supabase
    .from('files')
    .select('id, filename, title, kind, module_id, size_bytes, sort_status, created_at, week, summary')
    .not('size_bytes', 'is', null) // a saved name with no bytes is not a file
  // Search covers title, filename, summary and extracted text.
  if (q) filesQuery = filesQuery.textSearch('search', q, { type: 'websearch', config: 'english' })
  const [modules, res, namesRes] = await Promise.all([
    getModules({ includeArchived: true }),
    filesQuery.order('created_at', { ascending: false }).limit(1000),
    // Minerva often saves a name before the bytes exist. Those are not files, so they get their own list.
    supabase
      .from('files')
      .select('id, filename, title, module_id')
      .is('size_bytes', null)
      .eq('source', 'minerva')
      .order('filename'),
  ])
  const names = (namesRes.data ?? []) as { id: string; filename: string; title: string | null; module_id: string | null }[]
  const files = (res.data ?? []) as Row[]
  const codeOf = new Map(modules.map((m) => [m.id, m.code]))
  const needsLook = files.filter((f) => f.sort_status !== 'sorted')
  const sorted = files.filter((f) => f.sort_status === 'sorted')

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
      <form className="flex gap-2" action="/files">
        <input name="q" defaultValue={q} placeholder="Search names, summaries and text inside files" className="field" type="search" />
        <button className="rounded-md border border-line px-3 text-sm">Search</button>
      </form>
      {q ? (
        <p className="text-sm text-muted">
          {files.length} result(s) for “{q}”.{' '}
          <Link href="/files" prefetch={false} className="underline">
            Clear
          </Link>
        </p>
      ) : (
        <>
          <Uploader />
          <SortBacklog waiting={files.filter((f) => f.sort_status === 'pending').length} total={files.length} />
        </>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Needs a look <span className="tabular-nums">({needsLook.length})</span>
        </h2>
        {needsLook.length ? (
          <FileTable rows={needsLook} codeOf={codeOf} />
        ) : (
          <p className="text-sm text-muted">Nothing waiting.</p>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Sorted <span className="tabular-nums">({sorted.length})</span>
        </h2>
        {sorted.length ? (
          <div className="space-y-4">
            {[...new Set(sorted.map((f) => f.module_id))].map((mid) => (
              <div key={mid ?? 'none'}>
                <h3 className="mb-1.5 font-mono text-sm">{mid ? codeOf.get(mid) : 'No module'}</h3>
                <FileTable rows={sorted.filter((f) => f.module_id === mid).sort(compareFiles)} codeOf={codeOf} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sorted files appear here once the sorter runs (step 6).</p>
        )}
      </div>

      {names.length ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted">
            Names without a file ({names.length}): saved from Minerva, but the bytes never arrived
          </summary>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-dashed border-line">
            {names.map((n) => (
              <li key={n.id} className="flex items-center gap-3 px-4 py-2 text-sm text-muted">
                <span className="hidden w-20 shrink-0 font-mono text-xs sm:block">{n.module_id ? codeOf.get(n.module_id) : ''}</span>
                <Link href={`/files/${n.id}?from=${BACK}`} prefetch={false} className="min-w-0 flex-1 truncate hover:underline">
                  {n.title ?? n.filename}
                </Link>
                <span className="text-xs">Add the file</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}

function FileTable({ rows, codeOf }: { rows: Row[]; codeOf: Map<string, string> }) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {rows.map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="hidden w-20 shrink-0 font-mono text-xs sm:block">
            {f.module_id ? codeOf.get(f.module_id) : ''}
          </span>
          {/* prefetch off so browser Back returns to where I opened the file from */}
          <Link href={`/files/${f.id}?from=${BACK}`} prefetch={false} className="min-w-0 flex-1 truncate hover:underline">
            {f.title ?? f.filename}
          </Link>
          {f.kind ? <span className="hidden text-xs text-muted md:inline">{KIND_LABEL[f.kind] ?? f.kind}</span> : null}
          {f.week ? <span className="hidden text-xs text-muted sm:inline">Wk {f.week}</span> : null}
          {f.sort_status === 'failed' ? <span className="text-xs text-danger">Could not read</span> : null}
          <span className="hidden text-xs text-muted sm:inline">{formatBytes(f.size_bytes)}</span>
          <span className="text-xs text-muted">{formatDate(f.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}
