# Deployment

## Recommended host: Vercel

This repository is a **Node.js HTTP MCP server**, not a static site. Vercel must use the Node server builder (Fluid Compute). Do **not** set an Output Directory such as `public` — that is what failed production deploy `dpl_EtKApwRKnSzx8Doh2vSjuT1JdDTj` (`STATIC_BUILD_NO_OUT_DIR`).

Vercel’s Node.js backend captures `createServer()` + `listen()` **in the root `server.ts` file** (see [Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)). Production `dpl_BuCsDLnfK4BV8jkZfajKzE8yCh3s` built successfully after PR #3 but `GET /health` still 500’d with runtime source `static`: the entry imported a Server created in `mcp-server/src` (TypeScript) and Vercel did not attach that listener to requests.

The root entry now:

1. Calls `createServer()` and `listen(PORT)` in `server.ts` (the documented pattern).
2. Answers `GET /health` from pathname **before** loading MCP config (`{"status":"ok"}`).
3. Imports the compiled handler from `mcp-server/dist/server.js` (emitted by `npx tsc` during the Vercel build).

Do **not** add a `src/server.ts` symlink — Vercel also looks at `src/server` as an entrypoint and that competed with the root file.

Fluid Compute serves:

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
  "installCommand": "npm ci --prefix mcp-server --include=dev",
  "buildCommand": "npm run build",
  "outputDirectory": null,
  "functions": {
    "server.ts": {
      "includeFiles": "{AGENTS.md,docs/**,api/openapi.yaml,skills/**,mcp-server/dist/**}"
    }
  }
}
```

`framework: "node"` plus root `server.ts` (default export + `listen()`) is the Node server entry. `outputDirectory: null` means do **not** publish a static `public/` folder.

Vercel still runs `npm run build` (the root script delegates to `mcp-server`). That compile uses `npx tsc`, so the TypeScript binary comes from `mcp-server/node_modules`. `--include=dev` is required because setting `NODE_ENV=production` in the project would otherwise omit `devDependencies` and fail with `tsc: command not found` (exit 127), which is what happened on production redeploy `dpl_HJ8Ad1DTz2LMX5NQKofU3r9ASvzs` after env vars were added. `typescript` and `@types/node` are also listed as `dependencies` so a production `npm ci` still installs the compiler.

`includeFiles` ships reporting knowledge documents into the function bundle (`loadDocuments` reads them from `REPORTING_KNOWLEDGE_ROOT`, defaulting to the process working directory when `AGENTS.md` is present).

`GET /health` does not load reporting/OAuth config, so it can return `{"status":"ok"}` even if `AGENT_REPORTING_KEY` is missing. `/mcp` and OAuth metadata still require the production env vars.

### Project settings (Vercel dashboard)

Create or update the project from `lightningtransport/chatgpt-plugin` with:

| Setting | Value |
| --- | --- |
| Framework Preset | **Node.js** (`node`). Not Other + static output. |
| Root Directory | Repository root (do not set `mcp-server`; knowledge files live at the root) |
| Install Command | `npm ci --prefix mcp-server --include=dev` (from `vercel.json`) |
| Build Command | `npm run build` (uses `npx tsc` in `mcp-server`) |
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

- Vercel `tsc: command not found` / `npm run build` exit 127: `NODE_ENV=production` skipped `devDependencies`. Confirm `vercel.json` uses `npm ci --prefix mcp-server --include=dev`, `typescript` is a dependency, and the build script is `npx tsc`.
- Vercel `No Output Directory named "public"`: the project is still on the Other/static builder. Confirm `vercel.json` has `"framework": "node"`, `"outputDirectory": null`, and the dashboard Output Directory is not set to `public`.
- `500` on `/mcp` at startup in production: OAuth variables are missing or development auth is still selected. `/health` should still return `{"status":"ok"}`.
- `401`: inspect protected-resource metadata, issuer/audience, JWKS, scopes, and the Auth0 redirect allowlist.
- `503`/`504`: inspect host egress, upstream gateway availability, and timeout settings.
- Missing or stale tools: restart/refresh the ChatGPT MCP connection after metadata changes.
- ChatGPT cannot connect: confirm Vercel Deployment Protection is off and `/.well-known/oauth-protected-resource` is publicly reachable.
