import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const instant = false

export default async function DashboardPage() {
  await requireUserId()
  const supabase = await createClient()
  const { count } = await supabase.from('modules').select('id', { count: 'exact', head: true })

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-muted">
        Signed in. {count ?? 0} module{count === 1 ? '' : 's'} so far. Progress, assignments,
        lectures and files arrive in step 2.
      </p>
    </section>
  )
}
