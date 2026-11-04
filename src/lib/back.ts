/** A return path from ?from=, only if it is a same-site path. */
export function safeFrom(value: string | string[] | undefined, fallback = '/files'): string {
  const v = Array.isArray(value) ? value[0] : value
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return fallback
  return v
}

export function backLabel(path: string): string {
  if (path === '/') return 'Dashboard'
  if (path.startsWith('/assignments')) return 'Assignments'
  if (path.startsWith('/modules/')) {
    const [, , code, folder] = path.split('?')[0].split('/')
    return folder ? `${code} · ${folder[0].toUpperCase()}${folder.slice(1)}` : code
  }
  if (path.startsWith('/modules')) return 'Modules'
  if (path.startsWith('/lectures')) return 'Lectures'
  return 'Files'
}
