# Agent operating instructions — Lightning Transportation reporting

This repository is the canonical reporting contract for Lightning Transportation. It contains no operational records or credentials.

## Read in this order

1. `AGENTS.md`
2. `docs/agent-rules.md`
3. `docs/question-routing.md`
4. `docs/metric-definitions.md`
5. `docs/data-dictionary.md`
6. `api/openapi.yaml`
7. Authenticated runtime catalog: `GET /functions/v1/agent-reporting?report=catalog`

The five reporting-source schemas and 99 physical columns were verified on **2026-09-11**. The deployed catalog is the runtime contract. If it conflicts with the repository, stop and report the contradiction instead of guessing.

## Approved interfaces

- Approved AI service accounts use the read-only `agent-reporting` Edge Function with their assigned `x-agent-key`.
- The separate JWT-based `reporting-query` endpoint is for approved personal Supabase memberships; onboarding remains paused until company Auth email/SMTP is ready.
- Never bypass either gateway with a database password, service-role/secret key, arbitrary SQL, shared employee session, or direct raw-table access.
- Never put an agent key in a URL, browser client, prompt, log, screenshot, repository, or answer.

## Mandatory query behavior

- Choose the smallest report and load its current metadata when meaning, filters, joins, grain, or calculations are not already known.
- Use exact documented filter names and exact stored values. Unknown/duplicate parameters are errors.
- Supply required anchors: settlement reports need `period_from` or truck; DriverPay needs truck, driver, `out_from`, or `return_from`.
- Follow `next_offset` until `has_more=false` when all rows are needed. `count`/`page_count` is one page; `total_count` is the filtered total.
- Request sensitive fields only for an explicit user need. Every `AGENT_API_KEY` / `AGENT_API_KEY_<number>` is permitted to request the explicit sensitive-field allowlists by default; `AGENT_ALLOW_SENSITIVE_<n>=false` is the opt-out restriction for a specific key. Minimize and redact output.
- Treat a denied/empty response as evidence only about that request, not proof that the business fact is false or that upstream data is current.

## Non-negotiable analysis rules

- Settlements run Tuesday through Monday. Use an explicit period; never infer the current cycle from `To Report` alone.
- Stored `Gross`, `Total Expenses`, and `Net` are authoritative. `tonu` is an additional/Compass income component already included in Gross; expense components are already included in Total Expenses.
- Settlement Truck 1, 2, and 3 are owner-allocation buckets for Carlos, Jorge, and CDT—not physical trucks. Include them in the matching owner's general settlement totals; exclude them from physical-truck counts/rankings.
- `DriverPay` and `returns` are driver-row sources; count distinct truck identifiers for truck totals.
- Departures use only `DriverPay.Out Date`; historical returns use only `DriverPay.Return Date`. Intersect both only for an explicitly requested assignment-overlap analysis.
- Historical owner/dispatch comes from the historical row, not current `trucks`.
- **Relational fallback:** When a requested report field is absent from its primary record, look for it in related approved-report data before finalizing. CDL is the unique driver key across `drivers` and `DriverPay`; use it to resolve driver attributes. Truck number is the unique vehicle key; compare the documented field variants (such as `truck_number`, `Truck_Number`, `Truck`, `truck_no`, or `unit_number`) after safe type/format normalization.
- Use a left join from historical records to the current `trucks` master; missing current-master matches do not invalidate history. Never substitute a name, Supabase `ID`, or `returns.Ninox_ID` for a missing CDL or truck key.
- `returns.CDL` is a sensitive exact driver key: use it to resolve a return only when it matches a verified CDL in related approved data. Never use a name, Supabase `ID`, or `returns.Ninox_ID` as a substitute.

*Evidence: approved business rule confirmed 2026-09-11; `returns.CDL` and `drivers.Date of Hire` physical columns verified on 2026-09-11.*
- Planned Schedule_Teams and exact Ninox in-yard/on-road metrics are not available from these Supabase tables. State the limitation; do not approximate from similar fields.

## Required answer evidence

State source report/table, normalized filters, exact period, result and row/distinct count, pagination completeness, `as_of`, source-sync freshness limitation, and material grain/null/bucket/join/sensitivity caveats. Never present a truncated page or incomplete financial period as a complete total.

## User-correction feedback

On every user correction, send a sanitized `reporting_agent_correction` event using the byte-identical contracts in `schemas/correction-feedback-event.schema.json` and the packaged skill reference. Send the initial event as `unverified`; reuse the same UUID for a later `verified` or `rejected` update. Keep webhook URL/token runtime-only and exclude PII, credentials, sessions, raw rows, and unnecessary identifiers. Follow `docs/knowledge-maintenance.md`; feedback is not an approved business rule until verified.

## Required freshness and maintenance

Installed agents must maintain one `data-reporting-kit-sync` job at 10:00 AM and 2:00 PM local time. A failed sync must be disclosed before relying on stale instructions.

Verified answer-affecting knowledge must update the relevant docs, runtime metadata, OpenAPI, tests, packaged skill, and `CHANGELOG.md` in the same work cycle. Verify the live schema/function, push, and confirm the remote commit before declaring completion.
