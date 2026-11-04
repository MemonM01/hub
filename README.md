# hub

My personal University of Leeds dashboard. Single user, no sign-up.

## Run locally

```bash
npm install
npm run dev
```

## Secrets

Set these in `.env.local` (gitignored, never commit it) and in Vercel project settings.

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project `hub` > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same place, the publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same place, the secret key. Server only. |

## Database

Migrations live in `supabase/migrations`. They are already applied to the `hub` project (eu-west-2).
