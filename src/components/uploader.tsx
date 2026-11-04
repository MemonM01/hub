'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { abandonUpload, finishUpload, startUpload } from '@/lib/actions/files'

type Item = { name: string; progress: number; state: 'uploading' | 'done' | 'error'; message?: string }

function put(url: string, file: File, contentType: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', contentType)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage said ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('Could not reach storage (check the R2 CORS policy).'))
    xhr.send(file)
  })
}

export function Uploader({
  moduleId,
  assignmentId,
  fileId,
  label = 'Drop files here, or click to choose',
  compact = false,
}: {
  moduleId?: string
  assignmentId?: string
  fileId?: string
  label?: string
  compact?: boolean
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [over, setOver] = useState(false)

  const update = (i: number, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  async function upload(files: File[]) {
    const list = fileId ? files.slice(0, 1) : files
    const base = items.length
    setItems((xs) => [...xs, ...list.map((f) => ({ name: f.name, progress: 0, state: 'uploading' as const }))])
    for (const [n, file] of list.entries()) {
      const i = base + n
      const started = await startUpload({
        filename: file.name,
        size: file.size,
        type: file.type,
        moduleId,
        assignmentId,
        fileId,
      })
      if (!started.ok) {
        update(i, { state: 'error', message: started.error })
        continue
      }
      try {
        await put(started.url, file, started.contentType, (p) => update(i, { progress: p }))
        const done = await finishUpload(started.fileId)
        if (!done.ok) throw new Error(done.error)
        update(i, { state: 'done', progress: 1 })
      } catch (e) {
        if (!fileId) await abandonUpload(started.fileId)
        update(i, { state: 'error', message: (e as Error).message })
      }
    }
    router.refresh()
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const files = [...e.dataTransfer.files]
          if (files.length) upload(files)
        }}
        className={`w-full rounded-lg border border-dashed text-sm text-muted transition ${
          compact ? 'px-3 py-2' : 'px-4 py-8'
        } ${over ? 'border-accent bg-accent/5 text-ink' : 'border-line hover:border-accent'}`}
      >
        {label}
      </button>
      <input
        ref={input}
        type="file"
        multiple={!fileId}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) upload(files)
        }}
      />
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              {it.state === 'uploading' ? (
                <span className="text-xs tabular-nums text-muted">{Math.round(it.progress * 100)}%</span>
              ) : it.state === 'done' ? (
                <span className="text-xs text-accent">Uploaded</span>
              ) : (
                <span className="text-xs text-danger">{it.message}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
