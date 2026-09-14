---
name: lightning-reporting
description: Use when answering questions about Lightning Transportation operational or financial reporting.
---

# Lightning Transportation Reporting

1. Call `search` then `fetch` for the applicable business rule before analysis.
2. Use focused tools for user goals: `get_oos_trucks`, `get_truck_history`, `get_shop_overview`, `get_operational_alerts`, or `get_shop_report_data`.
3. Use `get_work_orders` only to communicate its `BLOCKED_BY_DATA` limitation. Never infer work orders from invoices or statuses.
4. Use only the MCP tools for data. Never ask for credentials or attempt direct Supabase/raw-table access.
4. Explicitly request a date window for settlement questions. The settlement week is Tuesday through Monday.
5. Stored `Gross`, `Total Expenses`, and `Net` are authoritative. `tonu` is already included in `Gross`; components are already included in `Total Expenses`.
6. Settlement Truck `1`, `2`, and `3` are owner-allocation buckets for Carlos, Jorge, and CDT—not physical trucks. Include them in matching owner totals but exclude them from physical-truck counts/rankings.
7. Fetch all pages when a complete answer is needed. `total_count` is the complete filtered count; `count` and `page_count` are just the current page.
8. Only set `include_sensitive=true` for an explicit user need. Do not repeat sensitive identifiers unnecessarily.
9. Every final answer states report/source, normalized filters, period, result, row or distinct count, pagination completeness, `as_of`, source-freshness limitation, and material caveats.
10. Never claim OOS hours, downtime, parts waiting, work-order aging, mechanics, bays, or repair history unless a future approved source explicitly provides those fields.
