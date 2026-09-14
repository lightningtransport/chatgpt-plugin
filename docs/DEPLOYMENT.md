# Deployment

## Recommended host: Vercel

This repository is a **Node.js HTTP MCP server**, not a static site. Vercel must use the Node server builder (Fluid Compute). Do **not** set an Output Directory such as `public` — that is what failed production deploy `dpl_EtKApwRKnSzx8Doh2vSjuT1JdDTj` (`STATIC_BUILD_NO_OUT_DIR`).

Vercel detects `server.ts` at the repository root (preferred) or `src/server.ts` (this repo keeps `src` as a symlink to `mcp-server/src`). The entry default-exports the Node `http.Server` and calls `listen()`. Fluid Compute serves:

- `GET /health`
- Streamable HTTP `POST` / `GET` / `DELETE` `/mcp`
- `GET /.well-known/oauth-protected-resource`

### Exact `vercel.json`

Committed at the repository root (this is the source of truth; it overrides dashboard Build/Output leftovers from the failed Other/static preset):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "node",
  "fluid": true,
  "installCommand": "npm ci --prefix mcp-server",
  "buildCommand": null,
  "outputDirectory": null,
  "functions": {
    "server.ts": {
      "includeFiles": "{AGENTS.md,docs/**,api/openapi.yaml,skills/**}"
    }
  }
}
```

`buildCommand: null` and `outputDirectory: null` mean **auto-detect for the Node server**, not “run `tsc` and publish `public/`”. Vercel bundles `server.ts`; do not add a separate static output folder. The `npm run build` / `tsc` script stays for Docker and local compile only.

`includeFiles` ships reporting knowledge documents into the function bundle (`loadDocuments` reads them from `REPORTING_KNOWLEDGE_ROOT`, defaulting to the process working directory when `AGENTS.md` is present).

### Project settings (Vercel dashboard)

Create or update the project from `lightningtransport/chatgpt-plugin` with:

| Setting | Value |
| --- | --- |
| Framework Preset | **Node.js** (`node`). Not Other + static output. |
| Root Directory | Repository root (do not set `mcp-server`; knowledge files live at the root) |
| Install Command | `npm ci --prefix mcp-server` (from `vercel.json`) |
| Build Command | Auto-detect / empty. **Do not** set `npm run build --prefix mcp-server` |
| Output Directory | Empty / unused. **Do not** set `public` |
| Node.js Version | 22.x or 24.x (`engines.node` is `>=22`) |
| Fluid Compute | On (`fluid: true`) |

1. Deploy. Confirm `https://YOUR_DEPLOYMENT.vercel.app/health` returns `{"status":"ok"}`.
2. The ChatGPT MCP URL is `https://YOUR_DEPLOYMENT.vercel.app/mcp`.

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

- Vercel `No Output Directory named "public"`: the project is still on the Other/static builder. Confirm `vercel.json` has `"framework": "node"`, `"buildCommand": null`, `"outputDirectory": null`, and the dashboard Build Command / Output Directory are not still set to `tsc` / `public`.
- `500` at startup in production: OAuth variables are missing or development auth is still selected.
- `401`: inspect protected-resource metadata, issuer/audience, JWKS, scopes, and the Auth0 redirect allowlist.
- `503`/`504`: inspect host egress, upstream gateway availability, and timeout settings.
- Missing or stale tools: restart/refresh the ChatGPT MCP connection after metadata changes.
- ChatGPT cannot connect: confirm Vercel Deployment Protection is off and `/.well-known/oauth-protected-resource` is publicly reachable.
