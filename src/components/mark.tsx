// The hub mark: a rounded square with a centre dot joined to four spokes.
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <g stroke="var(--accent-ink)" strokeWidth="2.5" strokeLinecap="round">
        <path d="M16 8v16M8 16h16" />
      </g>
      <circle cx="16" cy="16" r="4.5" fill="var(--accent)" stroke="var(--accent-ink)" strokeWidth="2.5" />
    </svg>
  )
}
