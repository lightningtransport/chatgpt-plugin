# Question routing and analysis rules

Read `AGENTS.md` first. Use the smallest `agent-reporting` report that answers the question, then consult `?report=<name>&metadata=true` for the current runtime contract.

| User question | `agent-reporting` report | Required filters / analysis |
|---|---|---|
| Current truck facts or fleet list | `trucks` | Use current owner/dispatcher/mechanic fields only. The settlement-only 1/2/3 allocation rule does not filter or classify this source. |
| Who/trucks are expected to return? | `returns` | Inclusive `return_from`/`return_to`. Count distinct `Truck` for trucks; rows represent drivers. |
| Historical assignment for a truck/driver | `driver_pay` | Anchor with `truck_number` or `driver_id`; review dates, transfers, and terminations. |
| Which trucks left in a period? | `driver_pay` | Filter `out_from`/`out_to` only; count distinct `Truck_Number`. |
| Which trucks returned historically? | `driver_pay` | Filter `return_from`/`return_to` only; count distinct `Truck_Number`. |
| Weekly headline gross/expense/net | `settlement_summary` | Supply `period_from` (and normally the same Tuesday in `period_to`) or a truck. |
| Full weekly expenses/components | `settlements` | Supply `period_from` or truck; use explicit period for owner/dispatch totals. |
| Current driver profile / hire date | `drivers` | Prefer exact `driver_id`; use `hire_from` / `hire_to` for Date of Hire ranges. Any `AGENT_API_KEY` can request the documented sensitive fields with `include_sensitive=true` unless its explicit `AGENT_ALLOW_SENSITIVE_<n>` control is set to `false`. |
| Planned teams/departures | unsupported | Requires live Ninox Schedule_Teams; do not substitute DriverPay history. |
| Exact trucks in yard/off duty/on road | unsupported | Supabase lacks `days_in_yard_` and numeric insurance-choice fields required by the Ninox definition. |

## Date rules

- Settlements: Tuesday `From` through the following Monday `To`. Use an exact Tuesday period anchor. Do not infer current cycle from `To Report` alone.
- DriverPay departures: use only `Out Date` unless another date is explicitly requested.
- DriverPay historical returns: use only `Return Date` unless another date is explicitly requested.
- Current expected returns: use nullable `returns.Return Date` directly as an ISO date.
- A populated row does not prove financial completion; check the requested metric for null values.

## Cardinality and join rules

- `DriverPay` and `returns` are driver-row sources. Deduplicate truck identifiers for truck counts.
- `settlements` is truck-or-bucket/week grain. Filter by `Truck` plus period for one row.
- Only in `settlements` and `settlement_summary`, Truck 1, 2, and 3 are non-physical owner-expense allocation buckets for Carlos, Jorge, and CDT. Each represents that owner's total `truck_loans` and `Insurance` not assigned to a specific physical truck. Include them in owner general totals, label them as non-physical, and exclude them from physical-truck counts/rankings.
- If the selected report does not contain a required attribute, retrieve it from related approved-report data before completing the answer. Use CDL as the driver key across `drivers` and `DriverPay`; use the truck-number field variants (`truck_number`, `Truck_Number`, `Truck`, `truck_no`, or `unit_number`) as the vehicle key after documented type/format normalization.
- Left-join historical rows to current `trucks`; history can contain retired/missing current-master numbers. Never use a name, Supabase `ID`, or `returns.Ninox_ID` as a surrogate key.
- `returns.CDL` is a sensitive exact driver key. Only associate a return with a driver when this CDL matches a verified CDL in related approved data; never use names, Supabase IDs, or `returns.Ninox_ID` as a substitute.

*Evidence: approved business rule confirmed 2026-09-11; `returns.CDL` physical column verified on 2026-09-11.*

## Pagination

For complete totals or lists, follow `next_offset` until `has_more=false`. `count` and `page_count` are the current page; `total_count` is the filtered total.

## Answer format

State source report/table, normalized filters, exact period, result and row/distinct count, `as_of`, source-freshness limitation, and material grain/null/bucket/join caveats.
