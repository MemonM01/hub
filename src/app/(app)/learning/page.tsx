import Link from 'next/link'
import type { Metadata } from 'next'
import { requireUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/format'
import { LearningEditor } from '@/components/learning-editor'

export const instant = false
export const metadata: Metadata = { title: 'Learning' }

export default async function LearningPage() {
  await requireUserId()
  const supabase = await createClient()
  const { data } = await supabase.from('learning_profiles').select('content, updated_at').maybeSingle()
  return (
    <section className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Learning</h1>
        <p className="mt-1 text-sm text-muted">
          One profile the assistant reads and can update through the connector. Every change, yours or its, is in{' '}
          <Link href="/activity" prefetch={false} className="underline">
            Activity
          </Link>{' '}
          and can be undone.
          {data?.updated_at ? ` Last changed ${formatDateTime(data.updated_at)}.` : ''}
        </p>
      </div>
      <LearningEditor content={data?.content ?? ''} />
    </section>
  )
}
