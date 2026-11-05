import { OPEN_CORS, SCOPE, issuer, oauthJson } from '@/lib/oauth/core'

export function OPTIONS() {
  return new Response(null, { status: 204, headers: OPEN_CORS })
}

// RFC 8414 metadata for the MCP connector.
export function GET(request: Request) {
  const iss = issuer(request)
  return oauthJson({
    issuer: iss,
    authorization_endpoint: `${iss}/oauth/authorize`,
    token_endpoint: `${iss}/oauth/token`,
    registration_endpoint: `${iss}/oauth/register`,
    revocation_endpoint: `${iss}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: SCOPE.split(' '),
  })
}
