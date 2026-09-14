# `agent-reporting` API guide

`agent-reporting` is the active read-only service-to-service interface for approved AI agents.

## Authentication

```http
GET /functions/v1/agent-reporting?report=catalog
x-agent-key: <assigned secret>
```

The key identifies an agent principal. The function is single-organization and authorizes requests by optional report allowlist, expiry, and sensitive-field permission. The function uses an internal Supabase admin credential; callers never receive it.

- `supabase/config.toml` sets `verify_jwt=false` only for this custom-key function and keeps `verify_jwt=true` for `reporting-query`.
- Never expose `x-agent-key` in browser/frontend code.
- Missing, expired, or invalid keys return `401`.
- A valid key whose explicit per-key report allowlist excludes a report, or whose matching `AGENT_ALLOW_SENSITIVE...` control is set to `false`, returns `403`. All `AGENT_API_KEY` / `AGENT_API_KEY_<number>` principals otherwise have full read access to the six approved reports and their explicit sensitive-field allowlists.

## Discover before querying

- `?report=catalog` returns all reports allowed for the key, global parameters, response semantics, business rules, and examples.
- `?report=<report>&metadata=true` returns exact physical fields, types, nullability, sensitive flags, Ninox mappings, filters, grain, joins, and calculations.

Supported data reports: `settlement_summary`, `settlements`, `driver_pay`, `drivers`, `returns`, and `trucks`.

## Strict request behavior

Explicit reports reject:

- unknown or duplicate parameters;
- impossible dates and reversed ranges;
- invalid numbers, booleans, limits, and offsets;
- blank filter values, nonnumeric numeric identifiers, and `temporal_driver` values other than `Yes` or `No`;
- missing required history/financial anchors;

- unauthorized `include_sensitive=true` for a key explicitly restricted by `AGENT_ALLOW_SENSITIVE_<n>=false`.

Global data parameters are `report`, `limit` (1–1000), `offset` (0–100000), and `include_sensitive` (`true`/`false`). Metadata requests accept only `report` and `metadata=true`.

## Pagination and evidence

Explicit data responses include:

```json
{
  "report": "trucks",
  "filters": {"physical_only": "true"},
  "offset": 0,
  "limit": 100,
  "count": 100,
  "page_count": 100,
  "total_count": 166,
  "has_more": true,
  "next_offset": 100,
  "as_of": "...",
  "source_freshness": "unknown: source tables do not expose a sync timestamp",
  "data": []
}
```

`count` is a compatibility alias for `page_count`, not the full total. Follow `next_offset` until `has_more=false` when all rows are required. A successful zero-row page has `total_count=0`; an offset beyond the available range returns HTTP `416`. If the upstream exact count is absent, the API returns `500` rather than substituting the page count.

## Legacy compatibility

A request that omits `report` remains the legacy `settlement_summary` call only when the key allows `settlement_summary`, and preserves its exact successful top-level response shape:

```json
{"count": 0, "data": []}
```

New agents must always send an explicit report and use the strict/paginated contract.

## Audit and access

Each authorized data request records request ID, configured principal role in `role`, agent-key identifier and principal role as distinct JSON fields, applied filters, `include_sensitive`, limit, offset, row count, outcome, and time in `public.agent_query_audit`. The key value is never stored. Authorized data is returned only after the audit insert succeeds; audit failure returns `500`. Upstream query failures are sanitized to `500` responses.
