export function ModuleTag({ code, color, className = '' }: { code: string | null | undefined; color?: string; className?: string }) {
  if (!code) return null
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums ${className}`}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color ?? 'var(--muted)' }} aria-hidden="true" />
      {code}
    </span>
  )
}
