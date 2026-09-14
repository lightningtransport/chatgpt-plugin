# Changelog

## 0.2.1

- Fix Vercel production builds: deploy as a Node.js HTTP server (`framework: "node"`) instead of a static site looking for `public/`.

## 0.2.0

- Ported the independent Lightning Transport ChatGPT/MCP plugin from `data-reporting-kit`.
- TypeScript MCP Streamable HTTP server with `/health`, `/mcp`, and `/.well-known/oauth-protected-resource`.
- Vercel-compatible Node.js server deploy plus Auth0 OAuth environment documentation.
- `AGENT_REPORTING_KEY` remains a host secret and is excluded from Git.
