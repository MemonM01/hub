import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Mark } from '@/components/mark'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

// No sign-up here on purpose. The one user is created in the Supabase dashboard.
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <Mark className="h-8 w-8" />
          <span className="text-xl font-semibold tracking-tight">hub</span>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
