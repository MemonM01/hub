const BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  py: 'text/x-python',
  java: 'text/x-java',
  c: 'text/x-c',
  h: 'text/x-c',
  cpp: 'text/x-c++',
  js: 'text/javascript',
  ts: 'text/typescript',
  html: 'text/html',
  htm: 'text/html',
  sql: 'text/x-sql',
  tex: 'text/x-tex',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
}

export function extOf(filename: string) {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

export function mimeFor(filename: string, given?: string | null) {
  if (given && given !== 'application/octet-stream') return given
  return BY_EXT[extOf(filename)] ?? 'application/octet-stream'
}

export type PreviewKind = 'pdf' | 'image' | 'text' | 'html' | 'docx' | 'pptx' | 'none'

export function previewKind(filename: string, mime: string | null): PreviewKind {
  const ext = extOf(filename)
  const m = mime ?? ''
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (ext === 'svg') return 'text' // never render uploaded SVG inline
  if (m.startsWith('image/')) return 'image'
  if (ext === 'html' || ext === 'htm' || m === 'text/html') return 'html'
  if (ext === 'docx') return 'docx'
  if (ext === 'pptx') return 'pptx'
  if (m.startsWith('text/') || ['json', 'md', 'csv', 'py', 'java', 'c', 'h', 'cpp', 'js', 'ts', 'sql', 'tex', 'txt'].includes(ext))
    return 'text'
  return 'none'
}
