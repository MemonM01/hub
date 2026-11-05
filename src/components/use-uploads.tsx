'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { abandonUpload, finishUpload, startUpload } from '@/lib/actions/files'

export type UploadItem = { name: string; progress: number; state: 'uploading' | 'done' | 'error'; message?: string }
export type UploadTarget = { moduleId?: string; assignmentId?: string; fileId?: string; autoFile?: boolean }

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

/** Signed PUT straight to R2, then the server checks the bytes. Shared by every drop zone. */
export function useUploads(target: UploadTarget) {
  const router = useRouter()
  const [items, setItems] = useState<UploadItem[]>([])

  const upload = useCallback(
    async (files: File[]) => {
      const list = target.fileId ? files.slice(0, 1) : files
      let base = 0
      setItems((xs) => {
        base = xs.length
        return [...xs, ...list.map((f) => ({ name: f.name, progress: 0, state: 'uploading' as const }))]
      })
      const update = (i: number, patch: Partial<UploadItem>) =>
        setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
      for (const [n, file] of list.entries()) {
        const i = base + n
        const started = await startUpload({ filename: file.name, size: file.size, type: file.type, ...target })
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
          if (!target.fileId) await abandonUpload(started.fileId)
          update(i, { state: 'error', message: (e as Error).message })
        }
      }
      router.refresh()
    },
    [router, target],
  )

  return { items, upload }
}

export function UploadList({ items, className = 'mt-2' }: { items: UploadItem[]; className?: string }) {
  if (!items.length) return null
  return (
    <ul className={`space-y-1 text-sm ${className}`}>
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
  )
}
