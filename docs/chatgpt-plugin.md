# ChatGPT plugin deployment

This repository is the independent Lightning Transport ChatGPT plugin. The server implementation is TypeScript and uses the official MCP Streamable HTTP transport.

## Components

- The ChatGPT skill (`skills/lightning-reporting/SKILL.md`) contains the minimum non-negotiable reporting instructions.
- The MCP server supplies `search` and `fetch` plus focused read-only tools for truck status, OOS facts, truck reporting history, operational facts, and structured report data.
- The existing `agent-reporting` Edge Function remains the only data gateway. The MCP server does not query Supabase tables directly.

## Required hosting controls

1. Host the MCP server on Vercel (HTTPS) with Auth0 as the OAuth authorization server compatible with ChatGPT plugins. Associate each ChatGPT user with a workspace identity and revoke access centrally when employment/access changes.
2. Store `AGENT_REPORTING_KEY` only in the Vercel project environment. Create a dedicated, least-privilege `agent-reporting` principal for this connector. Never place the key in the plugin, MCP tool results, logs, GitHub, or a ChatGPT prompt.
3. Restrict the plugin to approved users. Keep all exposed MCP tools read-only.
4. Monitor `public.agent_query_audit`, including principal, report, normalized filters, sensitivity flag, outcome, and count. A report response must fail closed if the upstream audit write fails.

## ChatGPT validation checklist

- `search` returns repository URLs, then `fetch` returns the authoritative document and produces citations.
- `catalog` returns only the dedicated connector principal's allowed reports.
- `metadata` is called before an unfamiliar report is queried.
- `run_report` rejects an unsupported filter before it reaches Supabase.
- Authorized and denied report calls leave correct audit rows.
- An explicit sensitive-data request is denied or minimized according to the connector principal's policy.
- A multi-page result is not summarized as complete until `has_more` is false.

Follow [`docs/CHATGPT_PLUGIN_SETUP.md`](CHATGPT_PLUGIN_SETUP.md), [`docs/AUTHENTICATION.md`](AUTHENTICATION.md), and the current OpenAI [plugin quickstart](https://developers.openai.com/plugins/quickstart) while connecting the deployed endpoint. Keep screenshots, OAuth client secrets, and service credentials outside this repository.
