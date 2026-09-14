# Lightning Reporting ChatGPT Plugin — MCP server

TypeScript remote, read-only MCP Streamable HTTP server that retrieves canonical reporting docs and proxies only the approved `agent-reporting` Edge Function.

See the repository [`README.md`](../README.md), [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md), and [`docs/AUTHENTICATION.md`](../docs/AUTHENTICATION.md).

```bash
npm install
npm run build
npm test
AGENT_REPORTING_KEY=... npm run dev
```

The service exposes Streamable HTTP at `/mcp`, `GET /health`, and `GET /.well-known/oauth-protected-resource` (JSON `resource` = `OAUTH_AUDIENCE`) on `PORT` (default `8000`). Authorization-server discovery on this host redirects to Auth0.
