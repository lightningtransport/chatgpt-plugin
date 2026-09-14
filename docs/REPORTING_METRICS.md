# Reporting metrics

This table records only metrics supported by the current approved reporting contract.

| Metric | Status | Definition/source |
| --- | --- | --- |
| Current truck count | IMPLEMENTED | Number of rows returned by `trucks`; current-state grain |
| Trucks marked OOS | IMPLEMENTED | Rows in `trucks` where `dispatcher` exactly equals `Out Of Services`; not downtime |
| Mechanic status breakdown | IMPLEMENTED | Literal `trucks.mechanic_status` values |
| Historical assignment count | IMPLEMENTED | `DriverPay` rows filtered by truck; rows are driver assignments, not distinct trucks |
| Settlement Gross | IMPLEMENTED | Stored `settlements.Gross` / summary value |
| Settlement Total Expenses | IMPLEMENTED | Stored `settlements.Total Expenses`; do not add components |
| Settlement Net | IMPLEMENTED | Stored `settlements.Net` |
| OOS hours | BLOCKED_BY_DATA | No OOS start/end timestamp |
| Downtime hours | BLOCKED_BY_DATA | No downtime event or start/end duration |
| Open work orders | BLOCKED_BY_DATA | No work-order source |
| Completed work orders | BLOCKED_BY_DATA | No work-order source |
| Waiting for parts | BLOCKED_BY_DATA | No parts or waiting-state source |
| Waiting for approval | BLOCKED_BY_DATA | No approval-state source |
| Backlog aging | BLOCKED_BY_DATA | No work-order creation/activity timestamps |
| MTTR | BLOCKED_BY_DATA | No repair start/complete event source |
| Repeat repairs | BLOCKED_BY_DATA | No repair/work-order history |
| Mechanic productivity | BLOCKED_BY_DATA | No mechanic entity, hours, or assignment source |
| Exact in-yard/on-road | BLOCKED_BY_DATA | Required Ninox fields are absent from Supabase sources |

Settlement calculations follow the canonical rules: periods are Tuesday through Monday, `tonu` is already included in Gross, expense components are already included in Total Expenses, and owner allocation buckets 1/2/3 are not physical trucks.

