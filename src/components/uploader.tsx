'use client'

import { useMemo, useRef, useState } from 'react'
import { UploadList, useUploads } from './use-uploads'

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
  const target = useMemo(() => ({ moduleId, assignmentId, fileId }), [moduleId, assignmentId, fileId])
  const { items, upload } = useUploads(target)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

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
      <UploadList items={items} />
    </div>
  )
}
