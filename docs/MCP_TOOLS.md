# MCP tools

All tools are read-only. They call the approved `agent-reporting` gateway or return a documented limitation. No tool accepts SQL, a database connection string, a service-role key, or a caller-selected organization.

## Tool contracts

| Name | When to use | Status |
| --- | --- | --- |
| `search` | Find canonical reporting rules and source documents | IMPLEMENTED |
| `fetch` | Retrieve a document returned by `search` for citations | IMPLEMENTED |
| `get_shop_overview` | High-level current truck/shop status | PARTIAL |
| `get_oos_trucks` | Current trucks whose dispatcher is exactly `Out Of Services` | PARTIAL |
| `get_work_orders` | Work-order, job, parts, mechanic, or backlog requests | BLOCKED_BY_DATA |
| `get_truck_history` | Current truck facts, DriverPay assignments, and settlement history | PARTIAL |
| `get_operational_alerts` | Measurable current status facts requiring review | PARTIAL |
| `get_shop_report_data` | Structured facts for an executive report over an explicit period | PARTIAL |

## Inputs and outputs

### `get_shop_overview`

Inputs: optional `dateFrom` and `dateTo` in `YYYY-MM-DD`. It queries current `trucks` data. The date range is reported as requested but cannot turn current-state rows into historical shop data.

Output includes current truck count, exact `dispatcher = Out Of Services` count, `mechanic_status` and dispatcher breakdowns, evidence, and blocked work-order/downtime fields.

### `get_oos_trucks`

Inputs: `minHoursOOS` (default 0) and `limit` (1–100). With `0`, it returns current rows filtered by exact `dispatcher = Out Of Services`. With a positive value it returns `BLOCKED_BY_DATA`, because no OOS start timestamp exists.

### `get_work_orders`

Accepts optional status, truck, category, mechanic, date range, and limit for forward compatibility. It always returns `BLOCKED_BY_DATA` until an approved report exposes work orders. It never approximates work orders from `LTR Invoices`, `mechanic_status`, or settlements.

### `get_truck_history`

Input: required `truckNumber`. It queries `trucks`, `driver_pay`, and `settlements` with the approved truck key and returns evidence for each source. Repair history is explicitly empty/unavailable.

### `get_operational_alerts`

Input: required `date`. It reports current `Out Of Services`, `Heavy Work No ETA`, and `Work in Progress` facts. Severity, duration, waiting states, and aging are null/unclassified unless the source provides them.

### `get_shop_report_data`

Inputs: required `dateFrom` and `dateTo`. It returns current truck status plus financial settlement summary for that explicit period. ChatGPT writes the narrative; it must not convert missing shop metrics into estimates.

## Evidence and limitations

Every data tool returns source/report, normalized filters, row/total counts, pagination completeness, `asOf` when supplied by the gateway, freshness limitation, and caveats. The upstream source does not expose reliable source-sync freshness.

Examples:

```text
“Muéstrame los trucks OOS.”
→ get_oos_trucks({minHoursOOS: 0, limit: 20})

“¿Qué trucks llevan más de 48 horas OOS?”
→ get_oos_trucks({minHoursOOS: 48, limit: 20})
→ BLOCKED_BY_DATA: no hay timestamp de inicio OOS

“Dame el historial del truck 1234.”
→ get_truck_history({truckNumber: "1234"})
```

