# Authentication

## Development

Run locally with `NODE_ENV=development` and `MCP_AUTH_MODE=development`. This bypass is only for localhost or a private development tunnel. The upstream `AGENT_REPORTING_KEY` is still required and remains server-side.

Do not expose development mode on a public hostname.

## Production (Auth0)

Use Auth0 as the OAuth 2.1 / OIDC provider. The Lightning tenant and MCP server expect:

- Tenant: `https://dev-50ed1gzziwaws2zo.us.auth0.com/`
- `MCP_AUTH_MODE=oauth`
- `OAUTH_ISSUER=https://dev-50ed1gzziwaws2zo.us.auth0.com/` (trailing slash required)
- `OAUTH_AUDIENCE=https://lightning-reporting.vercel.app/mcp` (placeholder until the real Vercel URL is provisioned; then set the API identifier to that canonical MCP resource)
- `OAUTH_JWKS_URL=https://dev-50ed1gzziwaws2zo.us.auth0.com/.well-known/jwks.json`
- `OAUTH_SCOPE=reporting:read`
- a token containing `sub`, matching issuer/audience, expiry, and the `reporting:read` scope

The server publishes `/.well-known/oauth-protected-resource` and returns a `WWW-Authenticate` challenge. Configure Auth0 for authorization-code + PKCE `S256`, preserve the MCP `resource` parameter, publish discovery metadata, and allow the redirect URI shown by ChatGPT for the connection.

### Auth0 application and API

1. Create an Auth0 API whose identifier equals `OAUTH_AUDIENCE` (currently the placeholder `https://lightning-reporting.vercel.app/mcp` until the real Vercel URL exists).
2. Add the permission / scope `reporting:read` and include it in issued access tokens.
3. Create an application that supports Authorization Code + PKCE.
4. Add the ChatGPT plugin redirect URI to Allowed Callback URLs.
5. Set Allowed Web Origins / CORS to the ChatGPT origins shown in the connection UI.

The current P0 maps every authenticated user to the same least-privilege reporting principal at the upstream gateway. Before multi-role production use, map the verified user identity to Lightning permissions and separate agent-reporting principals or a user-aware gateway. Never put `AGENT_REPORTING_KEY` in OAuth claims, tool inputs, URLs, browser code, logs, or plugin files.

## Access boundaries

The MCP cannot execute SQL or mutate data. The upstream gateway enforces report allowlists, sensitive-field policy, tenant scope, strict filters, and audit behavior. The MCP does not use `reporting-query`, which remains a separate paused membership flow.
