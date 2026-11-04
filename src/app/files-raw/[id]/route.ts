import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserId } from '@/lib/supabase/server'
import { signGet } from '@/lib/r2'
import { previewKind } from '@/lib/mime'

// GET /files-raw/:id            -> redirect to a fresh signed URL, shown inline
// GET /files-raw/:id?download=1 -> same, as a download
// Session-only (the proxy redirects anonymous users), and RLS limits the row to mine.
export async function GET(request: NextRequest, ctx: RouteContext<'/files-raw/[id]'>) {
  if (!(await getUserId())) return new NextResponse('Not signed in', { status: 401 })
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: file } = await supabase
    .from('files')
    .select('filename, mime_type, r2_key, size_bytes')
    .eq('id', id)
    .maybeSingle()
  if (!file) return new NextResponse('Not found', { status: 404 })
  if (file.size_bytes == null || !file.r2_key) {
    return new NextResponse('The bytes for this file never arrived.', { status: 404 })
  }
  const download = request.nextUrl.searchParams.has('download')
  // Only types we preview safely are served inline; everything else downloads.
  const kind = previewKind(file.filename, file.mime_type)
  const inline = !download && (kind === 'pdf' || kind === 'image')
  const url = await signGet(file.r2_key, file.filename, inline ? 'inline' : 'attachment', file.mime_type ?? undefined)
  return NextResponse.redirect(url, { status: 302, headers: { 'cache-control': 'no-store' } })
}
