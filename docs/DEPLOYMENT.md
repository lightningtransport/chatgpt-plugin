# Deployment

## Recommended host: Vercel

The TypeScript MCP server is a Node.js HTTP server. Vercel detects `src/server.ts` (this repository keeps that path as a link to `mcp-server/src/server.ts`) and captures `listen()`. Fluid Compute / the Node.js runtime serves:

- `GET /health`
- Streamable HTTP `POST` / `GET` / `DELETE` `/mcp`
- `GET /.well-known/oauth-protected-resource`

Create a Vercel project from `lightningtransport/chatgpt-plugin`:

1. Framework preset: Other (Node.js server). Root Directory: repository root.
2. Install command: `npm ci --prefix mcp-server`
3. Build command: `npm run build --prefix mcp-server`
4. Deploy. Confirm `https://YOUR_DEPLOYMENT.vercel.app/health` returns `{"status":"ok"}`.
5. The ChatGPT MCP URL is `https://YOUR_DEPLOYMENT.vercel.app/mcp`.

Disable Vercel Deployment Protection / Vercel Authentication for this project so ChatGPT can reach `/mcp` and the OAuth metadata URL. Access control is Auth0, not Vercel SSO.

### Vercel environment variables

Set these in the Vercel project (Production and Preview as appropriate). Mark secrets as sensitive. Never put them in Git.

| Variable | Required | Example / notes |
| --- | --- | --- |
| `AGENT_REPORTING_KEY` | yes | Dedicated least-privilege upstream key. **Secret. Never commit.** |
| `AGENT_REPORTING_ENDPOINT` | no | Defaults to the documented Supabase Edge Function URL |
| `NODE_ENV` | yes in production | `production` |
| `MCP_AUTH_MODE` | yes in production | `oauth` |
| `OAUTH_ISSUER` | yes in production | `https://dev-50ed1gzziwaws2zo.us.auth0.com/` (trailing slash) |
| `OAUTH_AUDIENCE` | yes in production | Placeholder `https://lightning-reporting.vercel.app/mcp` until the real Vercel URL exists |
| `OAUTH_JWKS_URL` | yes in production | `https://dev-50ed1gzziwaws2zo.us.auth0.com/.well-known/jwks.json` |
| `OAUTH_SCOPE` | no | `reporting:read` |
| `REPORTING_KNOWLEDGE_ROOT` | no | Defaults to the deployment working directory (repository root) |
| `MCP_REQUEST_TIMEOUT_MS` | no | Default `30000` |
| `MCP_RATE_LIMIT_RPM` | no | Default `60` |
| `MCP_MAX_PAGES` | no | Default `100` |
| `PORT` | no | Provided by Vercel; do not hardcode |

Do not claim a live URL until the Vercel project has actually been provisioned and `/health` succeeds.

## Docker

```bash
docker build -f Dockerfile -t lightning-reporting-mcp .
docker run --rm -p 8000:8000 \
  -e NODE_ENV=production \
  -e MCP_AUTH_MODE=oauth \
  -e AGENT_REPORTING_KEY \
  -e OAUTH_ISSUER -e OAUTH_AUDIENCE -e OAUTH_JWKS_URL \
  -e OAUTH_SCOPE=reporting:read \
  lightning-reporting-mcp
```

The container must not contain `.env`, secrets, or a database credential. Configure TLS and Auth0 at the service or a trusted proxy, and make sure the proxy supports POST/GET/DELETE for `/mcp`, preserves authorization headers, and does not buffer responses.

## Troubleshooting

- `500` at startup in production: OAuth variables are missing or development auth is still selected.
- `401`: inspect protected-resource metadata, issuer/audience, JWKS, scopes, and the Auth0 redirect allowlist.
- `503`/`504`: inspect host egress, upstream gateway availability, and timeout settings.
- Missing or stale tools: restart/refresh the ChatGPT MCP connection after metadata changes.
- ChatGPT cannot connect: confirm Vercel Deployment Protection is off and `/.well-known/oauth-protected-resource` is publicly reachable.
