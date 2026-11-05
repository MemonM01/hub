'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { UploadList, useUploads } from './use-uploads'

const hasFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes('Files')

/** The whole Assignments page: a dropped file is filed from the module code and sheet in its name. */
export function AssignmentsDropZone({ children }: { children: ReactNode }) {
  const target = useMemo(() => ({ autoFile: true }), [])
  const { items, upload } = useUploads(target)
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        setOver(false)
        upload([...e.dataTransfer.files])
      }}
      className={`relative rounded-lg transition ${over ? 'outline-2 outline-dashed outline-accent outline-offset-4' : ''}`}
    >
      <p className="mb-4 text-sm text-muted">Drop a worksheet here to file it by its name, or onto a sheet to attach it there.</p>
      <UploadList items={items} className="mb-3" />
      {children}
    </div>
  )
}

/** One assignment row: a dropped file is attached here and pinned. */
export function AssignmentRowDrop({ assignmentId, children }: { assignmentId: string; children: ReactNode }) {
  const target = useMemo(() => ({ assignmentId }), [assignmentId])
  const { items, upload } = useUploads(target)
  const [over, setOver] = useState(false)
  return (
    <li
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.stopPropagation() // this row, not the page
        setOver(false)
        upload([...e.dataTransfer.files])
      }}
      className={`px-4 py-2.5 transition ${over ? 'bg-accent/10 ring-2 ring-inset ring-accent' : ''}`}
    >
      {children}
      <UploadList items={items} className="mt-1 pl-13" />
    </li>
  )
}
