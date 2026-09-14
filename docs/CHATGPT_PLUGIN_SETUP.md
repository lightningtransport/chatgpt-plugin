# Connect to ChatGPT

This uses the current OpenAI Plugins/MCP flow, not the retired `ai-plugin.json` or a Custom GPT Action.

## Before connecting

1. Deploy the server to Vercel at a stable HTTPS URL ending in `/mcp`. See [`DEPLOYMENT.md`](DEPLOYMENT.md).
2. Configure Auth0 OAuth 2.1 and verify that `/.well-known/oauth-protected-resource` is reachable.
3. Store `AGENT_REPORTING_KEY` only in the Vercel project environment (sensitive). Never commit it.
4. Confirm `/health` and inspect the endpoint with MCP Inspector.

## Personal developer connection

Open ChatGPT on the web:

1. Open `Settings`.
2. Select `Security and login`.
3. Turn on `Developer mode` if the account/workspace permits it.
4. Go to `ChatGPT Plugins` and select the plus button.
5. Enter a user-facing name and description.
6. Under Connection, enter the complete HTTPS URL, including `/mcp`.
7. Create the connection and review the discovered tools and metadata.
8. Open personal plugins, select the plus button, and install the connection.
9. Return to the ChatGPT home page, switch `Chat` to `Work`, start a new Work chat, type `@`, and select the Lightning plugin.

## Evaluation prompts

Run these with an authorized user:

- “Muéstrame los trucks OOS.” Expected tool: `get_oos_trucks`; current literal status only.
- “¿Qué trucks llevan más de 48 horas OOS?” Expected result: `BLOCKED_BY_DATA` because the source lacks an OOS start time.
- “Dame el historial del truck 1234.” Expected tool: `get_truck_history`.
- “Dame los work orders abiertos.” Expected result: `BLOCKED_BY_DATA`, not a fabricated list.
- “Dame un resumen de settlements del 2026-09-01 al 2026-09-07.” Expected tool: `get_shop_report_data`, with an explicit period.

Record the selected tool, normalized arguments, returned evidence, pagination completeness, and any authorization/error response. Refresh the connection after changing tool metadata. Availability of Developer mode, Work, and Plugins depends on account, region, and workspace policy.
