import { Config } from "./config.js";

export type ReportName =
  | "settlement_summary"
  | "settlements"
  | "driver_pay"
  | "drivers"
  | "returns"
  | "trucks";

export type ReportingRow = Record<string, unknown>;
export type ReportingResponse = {
  report?: string;
  source?: string;
  filters?: Record<string, string>;
  data?: ReportingRow[];
  count?: number;
  page_count?: number;
  total_count?: number;
  has_more?: boolean;
  next_offset?: number | null;
  as_of?: string;
  source_freshness?: string;
  caveats?: string[];
  [key: string]: unknown;
};

const allowedParameters = new Set([
  "limit", "offset", "include_sensitive", "truck", "truck_number", "driver_id",
  "owner", "dispatch", "dispatcher", "insurance", "to_report", "period_from",
  "period_to", "out_from", "out_to", "return_from", "return_to", "transfer",
  "termination", "solo", "temporal_driver", "name", "first_name", "last_name",
  "state", "company", "min_experience", "max_experience", "hire_from", "hire_to",
  "ninox_id", "driver_name", "yard_location", "mechanic_status", "make",
  "min_odometer", "max_odometer", "min_model_year", "max_model_year",
]);

export class ReportingApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ReportingApiError";
  }
}

export class ReportingClient {
  constructor(
    private readonly config: Config,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async catalog(): Promise<ReportingResponse> {
    return this.get({ report: "catalog" });
  }

  async metadata(report: ReportName): Promise<ReportingResponse> {
    return this.get({ report, metadata: "true" });
  }

  async query(
    report: ReportName,
    filters: Record<string, string | number | boolean>,
    options: { allPages?: boolean } = {},
  ): Promise<ReportingResponse> {
    for (const [name, value] of Object.entries(filters)) {
      if (!allowedParameters.has(name)) throw new Error(`Unsupported reporting filter: ${name}`);
      if (value === "") throw new Error(`Reporting filter cannot be blank: ${name}`);
    }

    const first = await this.get({ report, ...filters, limit: filters.limit ?? 100, offset: filters.offset ?? 0 });
    if (options.allPages === false || first.has_more !== true) {
      return { ...first, complete: first.has_more !== true };
    }

    const rows = [...(first.data ?? [])];
    let nextOffset = first.next_offset;
    let pages = 1;
    while (first.has_more === true && nextOffset !== null && nextOffset !== undefined) {
      if (pages >= this.config.MCP_MAX_PAGES) {
        throw new ReportingApiError(502, "The reporting result exceeded the pagination safety limit.");
      }
      const page = await this.get({
        report,
        ...filters,
        limit: filters.limit ?? 100,
        offset: nextOffset,
      });
      rows.push(...(page.data ?? []));
      pages += 1;
      nextOffset = page.next_offset;
      if (page.has_more !== true) {
        return {
          ...page,
          data: rows,
          count: rows.length,
          page_count: rows.length,
          complete: true,
          pages_fetched: pages,
        };
      }
    }
    return { ...first, data: rows, count: rows.length, page_count: rows.length, complete: false, pages_fetched: pages };
  }

  private async get(parameters: Record<string, unknown>): Promise<ReportingResponse> {
    const url = new URL(this.config.AGENT_REPORTING_ENDPOINT);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, String(value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.MCP_REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json", "x-agent-key": this.config.AGENT_REPORTING_KEY },
        signal: controller.signal,
      });
      if (!response.ok) throw new ReportingApiError(response.status, messageForStatus(response.status));
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new ReportingApiError(502, "The reporting service returned an invalid response.");
      }
      return body as ReportingResponse;
    } catch (error) {
      if (error instanceof ReportingApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ReportingApiError(504, "The reporting service timed out.");
      }
      throw new ReportingApiError(503, "The reporting service is unavailable.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

function messageForStatus(status: number): string {
  if (status === 400) return "The reporting request was invalid.";
  if (status === 401) return "The reporting service authentication failed.";
  if (status === 403) return "The reporting service denied this request.";
  if (status === 416) return "The requested reporting page is outside the available range.";
  return "The reporting service could not complete this request.";
}

