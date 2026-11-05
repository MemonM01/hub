import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getObjectBytes } from '@/lib/r2'
import { previewKind, type PreviewKind } from '@/lib/mime'
import { bytesToText, docxToHtml, pptxToSlides, type Slide } from '@/lib/preview'
import { backLabel, safeFrom } from '@/lib/back'
import { formatBytes, formatDateTime } from '@/lib/format'
import { Uploader } from '@/components/uploader'
import { DeleteFileButton } from '@/components/delete-file-button'
import { FilingForm } from '@/components/sort-controls'
import { getModules } from '@/lib/data'
import { KIND_LABEL } from '@/lib/types'

export const instant = false

type FileDetail = {
  id: string
  filename: string
  title: string | null
  mime_type: string | null
  size_bytes: number | null
  r2_key: string | null
  kind: string | null
  week: number | null
  source: string
  summary: string | null
  pinned: boolean
  created_at: string
  module_id: string | null
  sort_status: string
  sort_confidence: number | null
  sort_error: string | null
  topic: string | null
  source_url: string | null
  modules: { code: string; topics: string[] } | null
  assignments: { sheet: string } | null
}

export default async function FilePage({ params, searchParams }: PageProps<'/files/[id]'>) {
  await requireUserId()
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const back = safeFrom(sp.from)
  const supabase = await createClient()
  const { data } = await supabase
    .from('files')
    .select(
      'id, filename, title, mime_type, size_bytes, r2_key, kind, week, source, summary, pinned, created_at, module_id, sort_status, sort_confidence, sort_error, topic, source_url, modules(code, topics), assignments(sheet)',
    )
    .eq('id', id)
    .maybeSingle()
  if (!data) notFound()
  const file = data as unknown as FileDetail
  const hasBytes = file.size_bytes != null && !!file.r2_key
  const kind = previewKind(file.filename, file.mime_type)

  return (
    <article className="space-y-5">
      <div>
        {/* prefetch off: the back link must land on the page I came from */}
        <Link href={back} prefetch={false} className="text-sm text-muted hover:text-ink">
          ← {backLabel(back)}
        </Link>
        <h1 className="mt-1 break-words text-xl font-semibold tracking-tight">{file.title ?? file.filename}</h1>
        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {file.title ? <Meta label="File" value={file.filename} /> : null}
          {file.modules ? <Meta label="Module" value={file.modules.code} /> : null}
          {file.assignments ? <Meta label="Sheet" value={file.assignments.sheet} /> : null}
          {file.kind ? <Meta label="Kind" value={KIND_LABEL[file.kind] ?? file.kind} /> : null}
          {file.topic ? <Meta label="Topic" value={file.topic} /> : null}
          {file.week != null ? <Meta label="Week" value={String(file.week)} /> : null}
          {hasBytes ? <Meta label="Size" value={formatBytes(file.size_bytes!)} /> : null}
          <Meta label="Added" value={formatDateTime(file.created_at)} />
          {file.source === 'minerva' ? <Meta label="From" value="Minerva" /> : null}
        </dl>
      </div>

      {hasBytes ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/files-raw/${file.id}?download=1`} className="btn-primary">
              Download
            </a>
            {file.source_url ? (
              <a href={file.source_url} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-sm">
                Open original
              </a>
            ) : null}
            {kind === 'pdf' || kind === 'image' ? (
              <a href={`/files-raw/${file.id}`} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-sm">
                Open in new tab
              </a>
            ) : null}
            <span className="ml-auto">
              <DeleteFileButton fileId={file.id} back={back} />
            </span>
          </div>
          {file.summary ? <p className="max-w-prose text-sm">{file.summary}</p> : null}
          {file.sort_status !== 'sorted' ? (
            <p className="text-xs text-muted">
              {file.sort_status === 'pending'
                ? 'Waiting for the sorter.'
                : file.sort_status === 'failed'
                  ? 'The sorter could not read this file.'
                  : `The sorter was not sure (${Math.round((file.sort_confidence ?? 0) * 100)}%), so it left this for you.`}
            </p>
          ) : null}
          {file.sort_error ? <p className="text-xs text-danger">Sorter: {file.sort_error}</p> : null}
          <FilingForm
            fileId={file.id}
            modules={await getModules()}
            current={{ moduleId: file.module_id, week: file.week, kind: file.kind, sheet: file.assignments?.sheet ?? null, topic: file.topic }}
            topics={file.modules?.topics ?? []}
          />
          {file.source_url && kind === 'html' ? (
            // Web slides (Quarto, reveal.js) need their own scripts and styles: show the original page.
            <iframe
              src={file.source_url}
              title="Original page"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              className="aspect-[16/10] w-full rounded-xl border border-line bg-white"
            />
          ) : (
            <Preview id={file.id} r2Key={file.r2_key!} kind={kind} />
          )}
        </>
      ) : (
        <div className="space-y-3 rounded-lg border border-dashed border-line p-4">
          <p className="text-sm">
            The bytes for this file never arrived. Only its name was saved, so there is nothing to preview or
            download yet.
          </p>
          <Uploader fileId={file.id} label="Drop the real file here to add it" compact />
          <DeleteFileButton fileId={file.id} back={back} />
        </div>
      )}
    </article>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt>{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}

async function Preview({ id, r2Key, kind }: { id: string; r2Key: string; kind: PreviewKind }) {
  if (kind === 'pdf') {
    return (
      <iframe
        src={`/files-raw/${id}`}
        title="PDF preview"
        className="h-[80dvh] w-full rounded-lg border border-line bg-white"
      />
    )
  }
  if (kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/files-raw/${id}`} alt="" className="max-h-[80dvh] max-w-full rounded-lg border border-line" />
  }
  if (kind === 'none') {
    return <p className="text-sm text-muted">No preview for this type. Use Download.</p>
  }

  const data = await loadPreview(r2Key, kind)
  if (data.type === 'error') return <p className="text-sm text-muted">{data.message}</p>
  if (data.type === 'text') {
    return (
      <div>
        <pre className="max-h-[80dvh] overflow-auto rounded-lg border border-line p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {data.text}
        </pre>
        {data.truncated ? <p className="mt-1 text-xs text-muted">Preview cut short. Download for the rest.</p> : null}
      </div>
    )
  }
  if (data.type === 'html') {
    // Rendered with scripts, forms and network access all off: it can only show text and styles.
    return (
      <iframe
        title="Page preview"
        sandbox=""
        srcDoc={data.html}
        className="h-[80dvh] w-full rounded-lg border border-line bg-white"
      />
    )
  }
  if (data.type === 'docx') {
    return (
      <div
        className="doc-preview max-h-[80dvh] overflow-auto rounded-lg border border-line bg-white p-6 text-sm text-black"
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    )
  }
  if (!data.slides.length) return <p className="text-sm text-muted">This deck has no slides with text.</p>
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {data.slides.map((s) => (
        <li key={s.n} className="aspect-[16/10] overflow-auto rounded-lg border border-line bg-white p-4 text-black">
          <div className="mb-1 text-[10px] text-neutral-500">Slide {s.n}</div>
          {s.lines.length ? (
            <>
              <p className="text-sm font-semibold">{s.lines[0]}</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {s.lines.slice(1).map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-neutral-500">No text on this slide.</p>
          )}
        </li>
      ))}
    </ol>
  )
}

type Loaded =
  | { type: 'error'; message: string }
  | { type: 'text'; text: string; truncated: boolean }
  | { type: 'docx'; html: string }
  | { type: 'html'; html: string }
  | { type: 'pptx'; slides: Slide[] }

async function loadPreview(r2Key: string, kind: PreviewKind): Promise<Loaded> {
  let bytes: Uint8Array
  try {
    bytes = await getObjectBytes(r2Key)
  } catch {
    return { type: 'error', message: 'Could not read this file from storage. Try Download.' }
  }
  try {
    if (kind === 'text') return { type: 'text', ...bytesToText(bytes) }
    if (kind === 'docx') return { type: 'docx', html: await docxToHtml(bytes) }
    if (kind === 'html') {
      const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">'
      return { type: 'html', html: csp + bytesToText(bytes).text }
    }
    return { type: 'pptx', slides: await pptxToSlides(bytes) }
  } catch {
    return { type: 'error', message: 'Could not build a preview. Use Download.' }
  }
}
