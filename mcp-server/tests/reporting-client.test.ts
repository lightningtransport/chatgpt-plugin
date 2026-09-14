import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { ReportingClient, ReportingApiError } from "../src/reporting-client.js";

const config = loadConfig({
  NODE_ENV: "test",
  AGENT_REPORTING_KEY: "test-only-key",
  AGENT_REPORTING_ENDPOINT: "https://example.test/functions/v1/agent-reporting",
});

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ReportingClient", () => {
  it("keeps the credential in the header and paginates complete results", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({
        report: "trucks",
        data: [{ truck_number: 1 }],
        total_count: 2,
        has_more: true,
        next_offset: 1,
      }))
      .mockResolvedValueOnce(response({
        report: "trucks",
        data: [{ truck_number: 2 }],
        total_count: 2,
        has_more: false,
        next_offset: null,
      }));

    const result = await new ReportingClient(config, fetchImpl).query("trucks", { limit: 1 });
    expect(result.complete).toBe(true);
    expect(result.data).toHaveLength(2);
    const firstRequest = fetchImpl.mock.calls[0][1] as RequestInit;
    expect((firstRequest.headers as Record<string, string>)["x-agent-key"]).toBe("test-only-key");
    expect(String(fetchImpl.mock.calls[0][0])).not.toContain("test-only-key");
  });

  it("rejects unsupported filters before making a request", async () => {
    const fetchImpl = vi.fn();
    await expect(new ReportingClient(config, fetchImpl).query("trucks", { drop_table: "true" } as never))
      .rejects.toThrow("Unsupported reporting filter: drop_table");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sanitizes upstream errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ error: "internal details" }, 403));
    await expect(new ReportingClient(config, fetchImpl).catalog())
      .rejects.toEqual(new ReportingApiError(403, "The reporting service denied this request."));
  });
});
