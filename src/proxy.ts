import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Paths that never redirect to login.
// Icons and the manifest: Safari fetches these without the session cookie.
// Token routes (sync API, OAuth, MCP) check their own bearer token and return 401, never a redirect.
const PUBLIC_PREFIXES = [
  '/login',
  '/auth/',
  '/bookmarklets/',
  '/api/sync/',
  '/oauth/',
  '/.well-known/',
  '/mcp',
]
const PUBLIC_EXACT = new Set(['/icon', '/apple-icon', '/manifest.webmanifest'])

function isPublic(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return new NextResponse(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
      { status: 500 },
    )
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const { pathname } = request.nextUrl

  // Public routes skip the session check entirely (and never touch cookies).
  if (isPublic(pathname)) return response

  // Refreshes the session cookie if needed and verifies the JWT.
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.search = ''
    login.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(login)
  }

  return response
}

export const config = {
  matcher: [
    // Everything except Next internals and static files with an extension.
    '/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|js)$).*)',
  ],
}
