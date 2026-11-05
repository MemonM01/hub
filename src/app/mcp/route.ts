import { NextResponse } from 'next/server'
import { OPEN_CORS, issuer, verifyAccessToken } from '@/lib/oauth/core'
import { TOOLS, callTool } from '@/lib/mcp/tools'
import { createAdminClient } from '@/lib/supabase/admin'

// A private MCP server over Streamable HTTP, answering each JSON-RPC POST with plain JSON.
// It reads the live database: a new file or lecture needs no new tool.

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }

function unauthorized(request: Request) {
  return new NextResponse(JSON.stringify({ error: 'invalid_token' }), {
    status: 401,
    headers: {
      ...OPEN_CORS,
      'content-type': 'application/json',
      'www-authenticate': `Bearer resource_metadata="${issuer(request)}/.well-known/oauth-protected-resource/mcp"`,
    },
  })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS })
}

export function GET() {
  // No server-initiated stream.
  return new Response('Method not allowed', { status: 405, headers: { ...OPEN_CORS, allow: 'POST' } })
}

export async function POST(request: Request) {
  const auth = await verifyAccessToken(request)
  if (!auth) return unauthorized(request)

  const { data: client } = await createAdminClient().from('oauth_clients').select('client_name').eq('client_id', auth.clientId).maybeSingle()
  const ctx = { userId: auth.userId, clientLabel: `mcp:${client?.client_name ?? 'app'}` }

  let body: Rpc | Rpc[]
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: OPEN_CORS })
  }

  const handle = async (msg: Rpc) => {
    if (msg.id === undefined || msg.id === null) return null // notification
    try {
      switch (msg.method) {
        case 'initialize': {
          const asked = String(msg.params?.protocolVersion ?? '')
          return {
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: 'hub', version: '1.0.0' },
              instructions:
                "Shafay's University of Leeds hub: his modules, assignments, Panopto lectures, Minerva files and timetable. Use search first, then get_file or get_lecture with a query to read the relevant parts. Only the learning profile can be changed.",
            },
          }
        }
        case 'ping':
          return { jsonrpc: '2.0', id: msg.id, result: {} }
        case 'tools/list':
          return { jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } }
        case 'tools/call': {
          const name = String(msg.params?.name ?? '')
          const args = (msg.params?.arguments as Record<string, unknown>) ?? {}
          try {
            const out = await callTool(name, args, ctx)
            return {
              jsonrpc: '2.0',
              id: msg.id,
              result: { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }], structuredContent: Array.isArray(out) ? { items: out } : out },
            }
          } catch (e) {
            return { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: (e as Error).message }], isError: true } }
          }
        }
        default:
          return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } }
      }
    } catch (e) {
      return { jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: (e as Error).message } }
    }
  }

  const headers = { ...OPEN_CORS, 'cache-control': 'no-store' }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter(Boolean)
    return out.length ? NextResponse.json(out, { headers }) : new Response(null, { status: 202, headers })
  }
  const out = await handle(body)
  return out ? NextResponse.json(out, { headers }) : new Response(null, { status: 202, headers })
}
