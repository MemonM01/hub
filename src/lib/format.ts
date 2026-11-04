import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'

// Everything is shown in Leeds time, whatever timezone the server runs in.
export const TZ = 'Europe/London'

// Only call during render after connection() (createClient does that).
export function formatDate(iso: string | null | undefined): string {
  return iso ? format(new TZDate(iso, TZ), 'd MMM yyyy') : ''
}
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? format(new TZDate(iso, TZ), 'EEE d MMM, HH:mm') : ''
}
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
