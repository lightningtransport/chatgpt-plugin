# Lightning Transport ChatGPT Plugin

Read-only ChatGPT / MCP plugin for Lightning Transportation reporting. Live data is retrieved only through the approved `agent-reporting` gateway. This repository is the independent plugin package; canonical reporting knowledge still lives in [data-reporting-kit](https://github.com/lightningtransport/data-reporting-kit).

## Components

- `mcp-server/`: TypeScript MCP Streamable HTTP server (`GET /health`, Streamable HTTP `/mcp`, `GET /.well-known/oauth-protected-resource`)
- `skills/lightning-reporting/SKILL.md`: reusable operating rules
- `docs/CHATGPT_PLUGIN_SETUP.md`, `docs/DEPLOYMENT.md`, `docs/AUTHENTICATION.md`: ChatGPT, Vercel, and Auth0 setup

## Security model

- The server exposes document retrieval plus report catalog, metadata, and approved reporting calls—never raw Supabase tables or SQL.
- `AGENT_REPORTING_KEY` is a server-only deployment secret. Do not add it to Git, a ChatGPT action, browser app, prompt, or URL.
- Production requires Auth0 OAuth (`MCP_AUTH_MODE=oauth`) against tenant `https://dev-50ed1gzziwaws2zo.us.auth0.com/` with `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_JWKS_URL`, and `OAUTH_SCOPE=reporting:read`.
- The connector is read-only. Do not add mutation tools without a separate approval and threat-model review.

## Local verification

```bash
cp .env.example mcp-server/.env
cd mcp-server
npm install
npm run build
npm test
AGENT_REPORTING_KEY=... npm run dev
```

Set `AGENT_REPORTING_KEY` through your shell or deployment-secret manager before starting the server. The service exposes Streamable HTTP at `/mcp` and `GET /health` on `PORT` (default `8000`). Use MCP Inspector with `http://localhost:8000/mcp`.

## Deployment and ChatGPT connection

1. Deploy this repository to Vercel as a **Node.js server** (recommended; see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — do not use a static `public` output directory) or build `Dockerfile` from the repository root.
2. Set `AGENT_REPORTING_KEY` as a host-managed secret. Set `AGENT_REPORTING_ENDPOINT` only if the Edge Function endpoint changes.
3. Configure Auth0 OAuth 2.1 + PKCE. See [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md) and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
4. In ChatGPT, enable Developer mode, open ChatGPT Plugins, add the hosted `/mcp` connection, and test it with an authorized account. See [`docs/CHATGPT_PLUGIN_SETUP.md`](docs/CHATGPT_PLUGIN_SETUP.md).

The precise ChatGPT publishing UI is administered by OpenAI and may change; follow the current [OpenAI plugin quickstart](https://platform.openai.com/plugins/quickstart) and [MCP guide](https://platform.openai.com/docs/mcp) when connecting the deployed endpoint.
