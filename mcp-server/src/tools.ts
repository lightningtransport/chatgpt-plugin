import { z } from "zod";
import { fetchDocument, searchDocuments } from "./knowledge.js";
import { ReportingClient, ReportName, ReportingRow, ReportingResponse } from "./reporting-client.js";
import { REPORTING_VIEW_URI } from "./ui.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const limit = z.number().int().min(1).max(100).default(20);
const output = z.object({}).passthrough();

export function registerTools(server: any, client: ReportingClient, documents: Map<string, string>) {
  server.registerTool("render_reporting_view", {
    title: "Render a Lightning reporting view",
    description: "Render a read-only visual report from a previous Lightning reporting tool result. Always call the data tool first, preserve its status, evidence, and limitations, then pass the complete structured result here. This does not fetch or alter data.",
    inputSchema: { title: z.string().min(1).max(120), data: output },
    outputSchema: z.object({ title: z.string(), data: output }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: REPORTING_VIEW_URI }, "openai/toolInvocation/invoking": "Rendering report…", "openai/toolInvocation/invoked": "Report view ready." },
  }, async ({ title, data }: { title: string; data: Record<string, unknown> }) => result({ title, data }, `Rendered the ${title} view.`));

  server.registerTool("search", {
    title: "Search Lightning reporting documentation",
    description: "Use this to find canonical Lightning reporting rules, metric definitions, and API guidance. Follow with fetch for the relevant document.",
    inputSchema: { query: z.string().min(1).max(500) },
    outputSchema: z.object({ results: z.array(z.object({ id: z.string(), title: z.string(), url: z.string().url() })) }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ query }: { query: string }) => result(searchDocuments(documents, query), `Found documentation for: ${query}.`));

  server.registerTool("fetch", {
    title: "Fetch Lightning reporting documentation",
    description: "Use this after search to retrieve the full canonical document identified by its id. Do not use it as a substitute for live report data.",
    inputSchema: { id: z.string().min(1) },
    outputSchema: output,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ id }: { id: string }) => result(fetchDocument(documents, id), `Fetched canonical document ${id}.`));

  server.registerTool("get_shop_overview", {
    title: "Get shop overview",
    description: "Use for a high-level view of currently documented truck/shop statuses. The current data source has no work-order table or downtime timestamps, so unavailable metrics are identified instead of estimated.",
    inputSchema: { dateFrom: isoDate.optional(), dateTo: isoDate.optional() },
    outputSchema: output,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) => {
    validateRange(dateFrom, dateTo);
    const trucks = await client.query("trucks", { limit: 1000 }, { allPages: true });
    const rows = trucks.data ?? [];
    const status = countBy(rows, "mechanic_status");
    const dispatch = countBy(rows, "dispatcher");
    return result({
      status: "PARTIAL",
      period: { from: dateFrom ?? null, to: dateTo ?? null },
      summary: {
        currentTrucks: rows.length,
        trucksOutOfServices: rows.filter((row) => row.dispatcher === "Out Of Services").length,
        workOrders: "BLOCKED_BY_DATA",
        downtime: "BLOCKED_BY_DATA",
      },
      workOrdersByStatus: [],
      workOrdersByCategory: [],
      mechanicStatusBreakdown: status,
      dispatcherBreakdown: dispatch,
      evidence: evidence(trucks, "trucks", { dateFrom, dateTo }),
      limitations: ["No Work Orders, Jobs, Bays, Parts, or downtime timestamps are documented in the approved reporting sources."],
    }, "Shop overview is partial because the approved source contains current truck status but no work-order ledger.");
  });

  server.registerTool("get_oos_trucks", {
    title: "Get out-of-service trucks",
    description: "Use when the user asks which trucks are unavailable or marked Out Of Services. The source exposes a current dispatcher/status value, not OOS start times; requests for hours OOS cannot be calculated.",
    inputSchema: { minHoursOOS: z.number().min(0).default(0), limit },
    outputSchema: output,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ minHoursOOS, limit: requestedLimit }: { minHoursOOS: number; limit: number }) => {
    if (minHoursOOS > 0) {
      return result({
        status: "BLOCKED_BY_DATA",
        requestedMinHoursOOS: minHoursOOS,
        summary: { total: null },
        items: [],
        limitations: ["No OOS start timestamp or downtime duration exists in the approved sources."],
      }, "OOS duration cannot be measured from the available data.");
    }
    const response = await client.query("trucks", { dispatcher: "Out Of Services", limit: 1000 }, { allPages: true });
    const items = (response.data ?? []).slice(0, requestedLimit).map((row) => ({
      truckNumber: row.truck_number ?? null,
      status: row.dispatcher ?? row.mechanic_status ?? null,
      oosSince: null,
      hoursOOS: null,
      workOrderId: null,
      job: null,
      mechanic: null,
      waitingReason: null,
    }));
    return result({
      status: "PARTIAL",
      summary: { total: response.data?.length ?? 0 },
      items,
      evidence: evidence(response, "trucks", { dispatcher: "Out Of Services" }),
      limitations: ["Only the current literal dispatcher status is available; OOS age and work-order fields are not documented."],
    }, `Found ${items.length} current trucks marked Out Of Services.`);
  });

  server.registerTool("get_work_orders", {
    title: "Get work orders",
    description: "Use when the user asks for work orders, jobs, parts, mechanics, or shop backlog. The current approved reporting contract has no work-order source, so this tool returns a precise data limitation and never invents records.",
    inputSchema: {
      status: z.string().nullable().optional(),
      truckNumber: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      mechanicId: z.string().nullable().optional(),
      dateFrom: isoDate.nullable().optional(),
      dateTo: isoDate.nullable().optional(),
      limit,
    },
    outputSchema: output,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => result({
    status: "BLOCKED_BY_DATA",
    summary: { total: null },
    items: [],
    limitations: ["No work_orders, jobs, parts, mechanics, bays, or shop backlog table/view/report is present in the approved repository contract."],
  }, "Work-order reporting is not available in the current approved data contract."));

  server.registerTool("get_truck_history", {
    title: "Get truck reporting history",
    description: "Use for a truck's documented reporting history. It combines current truck facts with historical DriverPay assignments and settlement rows; it is not a repair-history or work-order lookup.",
    inputSchema: { truckNumber: z.string().min(1).max(50) },
    outputSchema: output,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ truckNumber }: { truckNumber: string }) => {
    const [truck, assignments, settlements] = await Promise.all([
      client.query("trucks", { truck_number: truckNumber, limit: 100 }, { allPages: true }),
      client.query("driver_pay", { truck_number: truckNumber, limit: 100 }, { allPages: true }),
      client.query("settlements", { truck: truckNumber, limit: 100 }, { allPages: true }),
    ]);
    return result({
      status: "PARTIAL",
      truckNumber,
      currentTruck: truck.data?.[0] ?? null,
      assignments: assignments.data ?? [],
      settlements: settlements.data ?? [],
      repairHistory: [],
      evidence: [evidence(truck, "trucks", { truck_number: truckNumber }), evidence(assignments, "driver_pay", { truck_number: truckNumber }), evidence(settlements, "settlements", { truck: truckNumber })],
      limitations: ["Repair/work-order history is not available; historical owner/dispatch comes from historical rows."],
    }, `Retrieved documented reporting history for truck ${truckNumber}.`);
  });

  server.registerTool("get_operational_alerts", {
    title: "Get operational alerts",
    description: "Use for facts that may need operational attention. It reports measurable current statuses only and does not infer severity, downtime hours, waiting queues, or business impact absent from the data.",
    inputSchema: { date: isoDate },
    outputSchema: output,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ date }: { date: string }) => {
    const response = await client.query("trucks", { limit: 1000 }, { allPages: true });
    const rows = response.data ?? [];
    const alerts = rows
      .filter((row) => row.dispatcher === "Out Of Services" || ["Heavy Work No ETA", "Work in Progress"].includes(String(row.mechanic_status)))
      .map((row) => ({
        type: row.dispatcher === "Out Of Services" ? "TRUCK_MARKED_OUT_OF_SERVICES" : "TRUCK_MECHANIC_STATUS",
        severity: "unclassified",
        truckNumber: row.truck_number ?? null,
        status: row.dispatcher ?? row.mechanic_status ?? null,
        hoursOOS: null,
      }));
    return result({
      status: "PARTIAL",
      date,
      summary: { total: alerts.length, critical: null, warning: null },
      alerts,
      evidence: evidence(response, "trucks", { date }),
      limitations: ["Severity, aging, OOS duration, parts waiting, approval waiting, and repeat repairs are not measurable from current sources."],
    }, `Found ${alerts.length} measurable current status facts for ${date}.`);
  });

  server.registerTool("get_shop_report_data", {
    title: "Get shop report data",
    description: "Use to prepare structured data for an executive or management report. It returns facts and explicit unavailable metrics; ChatGPT writes the narrative and must not fabricate blocked KPIs.",
    inputSchema: { dateFrom: isoDate, dateTo: isoDate },
    outputSchema: output,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    validateRange(dateFrom, dateTo);
    const [trucks, settlements] = await Promise.all([
      client.query("trucks", { limit: 1000 }, { allPages: true }),
      client.query("settlement_summary", { period_from: dateFrom, period_to: dateTo, limit: 1000 }, { allPages: true }),
    ]);
    const rows = trucks.data ?? [];
    return result({
      status: "PARTIAL",
      period: { from: dateFrom, to: dateTo },
      kpis: {
        currentTrucks: rows.length,
        trucksOutOfServices: rows.filter((row) => row.dispatcher === "Out Of Services").length,
        openWorkOrders: null,
        completedWorkOrders: null,
        avgDowntimeHours: null,
      },
      statusBreakdown: countBy(rows, "mechanic_status"),
      topIssues: [],
      oosTrucks: rows.filter((row) => row.dispatcher === "Out Of Services").map((row) => row.truck_number ?? null),
      backlog: { workOrders: null },
      comparison: { available: false },
      settlementSummary: settlements.data ?? [],
      evidence: [evidence(trucks, "trucks", { dateFrom, dateTo }), evidence(settlements, "settlement_summary", { period_from: dateFrom, period_to: dateTo })],
      limitations: ["The available settlement summary is financial, not a Shop work-order report. No work-order, downtime, parts, or repair tables are documented."],
    }, `Prepared structured reporting data for ${dateFrom} through ${dateTo}.`);
  });
}

function result(data: Record<string, unknown>, text: string) {
  return { structuredContent: data, content: [{ type: "text", text }] };
}

function validateRange(from?: string, to?: string) {
  if (from && to && from > to) throw new Error("dateFrom must be on or before dateTo.");
}

function countBy(rows: ReportingRow[], field: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[field] ?? "(null)");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

function evidence(response: ReportingResponse, source: string, filters: Record<string, unknown>) {
  return {
    source: response.source ?? source,
    report: response.report ?? source,
    filters,
    rowCount: response.data?.length ?? response.count ?? 0,
    totalCount: response.total_count ?? response.data?.length ?? 0,
    complete: response.complete ?? response.has_more === false,
    asOf: response.as_of ?? null,
    sourceFreshness: response.source_freshness ?? "Source sync freshness is not exposed by the reporting gateway.",
    caveats: response.caveats ?? [],
  };
}
