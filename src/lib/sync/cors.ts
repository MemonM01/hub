import 'server-only'
import { NextResponse } from 'next/server'

// Only the sites my bookmarklets run on may call the sync API from a browser.
const ALLOWED = new Set(['https://leeds.cloud.panopto.eu', 'https://minerva.leeds.ac.uk'])

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  if (!ALLOWED.has(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '600',
    // Lets Chrome call a localhost dev server from the public Panopto page.
    'access-control-allow-private-network': 'true',
    vary: 'origin',
  }
}

export function preflight(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders(request), 'cache-control': 'no-store' } })
}
