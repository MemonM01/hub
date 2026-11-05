import { OPEN_CORS, SCOPE, issuer, oauthJson } from '@/lib/oauth/core'

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS })
}

// RFC 9728: the MCP endpoint is protected by this app's own authorization server.
export function GET(request: Request) {
  const iss = issuer(request)
  return oauthJson({
    resource: `${iss}/mcp`,
    authorization_servers: [iss],
    bearer_methods_supported: ['header'],
    scopes_supported: SCOPE.split(' '),
    resource_name: 'hub',
  })
}
