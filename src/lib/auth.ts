import 'server-only'
import { redirect } from 'next/navigation'
import { getUserId } from '@/lib/supabase/server'

// Data access layer guard. The proxy already redirects, this is the second check.
export async function requireUserId(): Promise<string> {
  const userId = await getUserId()
  if (!userId) redirect('/login')
  return userId
}
