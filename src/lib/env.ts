import 'server-only'

// Read a required env var. Never fall back to a made-up value.
function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env.local (local) and in Vercel project settings (production).`,
    )
  }
  return value
}

export const env = {
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () => required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  r2AccountId: () => required('R2_ACCOUNT_ID'),
  r2AccessKeyId: () => required('R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: () => required('R2_SECRET_ACCESS_KEY'),
  r2Bucket: () => required('R2_BUCKET'),
}
