import Link from 'next/link'
import type { Metadata } from 'next'
import { requireUserId } from '@/lib/auth'
import { getAssignments, getModules, progressFor } from '@/lib/data'
import { AddModuleForm } from '@/components/add-module-form'
import { ProgressBar } from '@/components/progress-bar'

export const instant = false
export const metadata: Metadata = { title: 'Modules' }

export default async function ModulesPage() {
  await requireUserId()
  const [modules, assignments] = await Promise.all([getModules({ includeArchived: true }), getAssignments()])
  const active = modules.filter((m) => !m.archived)
  const archived = modules.filter((m) => m.archived)

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
      <AddModuleForm />
      {active.length === 0 ? (
        <p className="text-sm text-muted">No modules yet. Add one by its code above.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((m) => {
            const p = progressFor(m.id, assignments)
            return (
              <li key={m.id}>
                <Link
                  href={`/modules/${m.code}`}
                  prefetch={false}
                  className="block rounded-lg border border-line p-4 hover:border-accent"
                >
                  <div className="font-mono text-sm font-medium">{m.code}</div>
                  <div className="mt-0.5 truncate text-sm text-muted">{m.name ?? 'No name'}</div>
                  <div className="mt-3">
                    <ProgressBar done={p.done} total={p.total} />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {archived.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted">Archived ({archived.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {archived.map((m) => (
              <li key={m.id}>
                <Link href={`/modules/${m.code}`} prefetch={false} className="font-mono hover:underline">
                  {m.code}
                </Link>{' '}
                <span className="text-muted">{m.name}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
