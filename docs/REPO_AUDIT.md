# Repository audit

Audited from the `data-reporting-kit` contract on 2026-09-14 and ported into this independent plugin repository. This package is an MCP integration, not a direct database application. The authenticated `agent-reporting` catalog is the runtime source of truth when it differs from checked-in documentation. Canonical knowledge remains in [data-reporting-kit](https://github.com/lightningtransport/data-reporting-kit).

## Documented data inventory

| Domain | Tables/Views | Important fields | Confidence |
| --- | --- | --- | --- |
| Fleet | `public.trucks` | `truck_number`, `dispatcher`, `owner`, `mechanic_status`, `yard_location`, odometer and Samsara timestamps | CONFIRMED |
| Driver assignments | `public."DriverPay"` | `Truck_Number`, `Out Date`, `Return Date`, transfer/termination fields, pay fields, CDL | CONFIRMED |
| Drivers | `public.drivers` | `Ninox_ID`, names, CDL, hire date, insurance and sensitive profile fields | CONFIRMED |
| Expected returns | `public.returns` | `Truck`, `Driver Name`, nullable `Return Date`, CDL | CONFIRMED |
| Financial reporting | `public.settlements`, `reporting.settlement_summary` | weekly Tuesday–Monday period, Gross, Total Expenses, Net, miles and expense fields | CONFIRMED |
| Audit | `public.agent_query_audit` | server-side reporting request audit; clients cannot read it | CONFIRMED |
| Membership authorization | `public.user_memberships` | JWT membership/role support for the separate paused `reporting-query` path | PARTIAL |
| Trailers | None documented | Only `settlements."Trailer Rentals"` is an expense component; no trailer identity or status | PARTIAL |
| Shop work orders/jobs | None documented | No work-order or job identifier, status, category, activity, or repair table | UNKNOWN |
| Mechanics | None documented | `trucks.mechanic_status` is a literal truck status, not a mechanic entity or assignment | PARTIAL |
| Bays | None documented | No bay, queue, or location workflow fields | UNKNOWN |
| Parts | None documented | No parts inventory, purchase, consumption, or waiting state | UNKNOWN |
| OOS/downtime | No duration source | `dispatcher = Out Of Services` is a current literal value; no OOS start/end timestamps | PARTIAL |
| Waiting states | None documented | No waiting-for-parts or waiting-for-approval field | UNKNOWN |

## Keys and relationships

- Supabase `ID` is an import-row key, not a business identifier.
- `trucks.truck_number` is unique in the current fleet master.
- `settlements` is one truck-or-owner-bucket row per Tuesday–Monday period.
- `DriverPay` and `returns` are driver-row sources; truck counts must use distinct truck identifiers.
- `DriverPay.DriversDB_ID` to `drivers.Ninox_ID::text` is a documented logical legacy join.
- CDL is the documented driver fallback key across `drivers`, `DriverPay`, and `returns`; a return CDL is sensitive and must match a verified related CDL.
- Truck number is the documented vehicle key across field variants. Historical data is left-joined to current trucks; missing current matches do not invalidate history.
- No foreign-key declarations are documented in the repository migrations. These are approved logical joins, not assumed database FKs.

## Dates and business rules

- Settlements run Tuesday through the following Monday and require an explicit period.
- Departures use only `DriverPay."Out Date"`.
- Historical returns use only `DriverPay."Return Date"`.
- Current expected returns use nullable `returns."Return Date"`.
- `trucks.samsara_last_connected_at` is a current connection timestamp, not downtime.
- Settlement `Truck` values 1, 2, and 3 are owner-allocation buckets for Carlos, Jorge, and CDT, not physical trucks.
- Stored settlement `Gross`, `Total Expenses`, and `Net` are authoritative; `tonu` is already included in Gross.

## Connection and access

The approved AI interface is:

```text
GET https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting
Header: x-agent-key: <server-managed secret>
```

The MCP server uses this HTTPS gateway only. It does not use `DATABASE_URL`, `@supabase/supabase-js`, a database password, a service-role key, raw tables, arbitrary SQL, or the paused JWT `reporting-query` endpoint. The key is loaded only from `AGENT_REPORTING_KEY` in the MCP host secret manager.

The gateway provides catalog discovery, per-report metadata, strict filters, pagination, sensitivity controls, source freshness caveats, and server-side audit. Data responses must be treated as incomplete until `has_more` is false.

## Existing queries and integration assets

- [`api/openapi.yaml`](../api/openapi.yaml) defines the reporting gateway contract.
- [`docs/question-routing.md`](question-routing.md) maps user intents to reports.
- The TypeScript client in [`mcp-server/src/reporting-client.ts`](../mcp-server/src/reporting-client.ts) paginates the approved gateway.
- [`mcp-server/`](../mcp-server) contains the executable MCP connector.
- Upstream Edge Function tests and live smoke tests live in `data-reporting-kit`.

## Explicit gaps

The repository cannot support factual Work Order, Job, Parts, Bay, mechanic-roster, downtime-duration, waiting-queue, or repair-history reporting. The MCP returns `BLOCKED_BY_DATA` or a clearly marked partial result for those requests. No schema, table, relationship, metric, or credential is invented to fill these gaps.
