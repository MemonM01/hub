'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const SECTIONS = [
  { href: '/', label: 'Dashboard' },
  { href: '/modules', label: 'Modules' },
  { href: '/assignments', label: 'Assignments' },
  { href: '/lectures', label: 'Lectures' },
  { href: '/files', label: 'Files' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/learning', label: 'Learning' },
  { href: '/activity', label: 'Activity' },
  { href: '/settings', label: 'Settings' },
] as const

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
}

export function Nav() {
  const pathname = usePathname()
  const current = SECTIONS.find((s) => isActive(pathname, s.href)) ?? SECTIONS[0]

  return (
    <>
      {/* Laptop: a wrapping row of links */}
      <nav aria-label="Sections" className="hidden flex-wrap gap-x-1 gap-y-1 md:flex">
        {SECTIONS.map((s) => {
          const active = isActive(pathname, s.href)
          return (
            <Link
              key={s.href}
              href={s.href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={`rounded-md px-2.5 py-1 text-sm ${
                active ? 'bg-ink text-paper' : 'text-muted hover:bg-line hover:text-ink'
              }`}
            >
              {s.label}
            </Link>
          )
        })}
      </nav>

      {/* Phone: the current section as a compact menu */}
      <details className="group relative md:hidden" key={pathname}>
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-line px-2.5 py-1 text-sm">
          {current.label}
          <svg viewBox="0 0 12 12" className="h-3 w-3 transition group-open:rotate-180" aria-hidden="true">
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </summary>
        <ul className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-line bg-paper p-1 shadow-lg">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                prefetch={false}
                aria-current={isActive(pathname, s.href) ? 'page' : undefined}
                className="block rounded-md px-2.5 py-1.5 text-sm aria-[current=page]:bg-line aria-[current=page]:font-medium"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </>
  )
}
