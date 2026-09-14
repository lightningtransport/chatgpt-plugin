# ChatGPT UI plan

UI is intentionally deferred until the headless MCP tools and data contract are verified. Every tool remains useful when no component renders.

## P1 candidates

- Shop overview: KPI cards for current trucks and literal OOS count, with an explicit “not available” state for work orders/downtime.
- OOS list: sortable table of truck number, dispatcher status, yard location, and mechanic status.
- Truck history: tabs for current truck, assignments, and settlements.
- Executive report: period header, financial settlement table, status breakdown, caveat panel.
- Alerts: list of measurable current status facts with unclassified severity rather than invented urgency.

## Implementation direction

Use the current MCP Apps UI standard and register versioned `text/html;profile=mcp-app` resources only for tools that benefit from inspection or comparison. Associate each UI resource with a tool using its UI metadata and provide concise `structuredContent` plus model-readable text as the fallback.

UI must:

- receive only the minimum structured data required;
- never receive `AGENT_REPORTING_KEY`, OAuth tokens, raw connection strings, or unnecessary PII;
- use a narrow CSP with explicit `connectDomains`/`resourceDomains`;
- show `BLOCKED_BY_DATA`, freshness, period, and pagination evidence;
- remain read-only and accessible without relying on `window.openai` extensions.

