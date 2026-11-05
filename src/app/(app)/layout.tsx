import { Suspense } from 'react'
import Link from 'next/link'
import { Mark } from '@/components/mark'
import { Nav } from '@/components/nav'

export const instant = false

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link href="/" prefetch={false} className="flex shrink-0 items-center gap-2">
            <Mark className="h-6 w-6" />
            <span className="font-semibold tracking-tight">hub</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 md:ml-4 md:flex-1">
            <Nav />
            <form action="/auth/signout" method="post" className="md:ml-auto">
              <button type="submit" className="rounded-md px-2 py-1 text-sm text-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>{children}</Suspense>
      </main>
    </>
  )
}
