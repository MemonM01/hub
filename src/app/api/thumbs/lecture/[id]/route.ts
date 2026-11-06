import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signGet } from '@/lib/r2'

// A lecture's preview image. My session (RLS) decides whether I can see the row.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('lectures').select('thumbnail_key').eq('id', id).maybeSingle()
  if (!data?.thumbnail_key) return new NextResponse(null, { status: 404 })
  const url = await signGet(data.thumbnail_key, 'preview.webp', 'inline', 'image/webp')
  return NextResponse.redirect(url, { status: 302, headers: { 'cache-control': 'private, max-age=300' } })
}
