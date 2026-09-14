# Changelog

## 0.2.2

- Fix Vercel production rebuilds when `NODE_ENV=production` is set: install TypeScript (`--include=dev`), keep `typescript` as a dependency, and invoke `npx tsc` so `npm run build` finds the local compiler.
- Keep the Node.js entry (`framework: "node"`, root `server.ts` listen + default export) and serve `/health` without requiring full runtime config, including when the URL has a query string.

## 0.2.1

- Fix Vercel production builds: deploy as a Node.js HTTP server (`framework: "node"`) instead of a static site looking for `public/`.

## 0.2.0

- Ported the independent Lightning Transport ChatGPT/MCP plugin from `data-reporting-kit`.
- TypeScript MCP Streamable HTTP server with `/health`, `/mcp`, and `/.well-known/oauth-protected-resource`.
- Vercel-compatible Node.js server deploy plus Auth0 OAuth environment documentation.
- `AGENT_REPORTING_KEY` remains a host secret and is excluded from Git.
