import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "node:http";
import { createRemoteJWKSet } from "jose";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authenticate } from "./auth.js";
import { type Config, loadConfig } from "./config.js";
import { loadDocuments } from "./knowledge.js";
import { ReportingClient } from "./reporting-client.js";
import { registerTools } from "./tools.js";
import { registerReportingView } from "./ui.js";
import { handleOAuthBridge } from "./oauth-bridge.js";

type Runtime = {
  config: Config;
  documents: Map<string, string>;
  client: ReportingClient;
  jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
};

let runtimePromise: Promise<Runtime> | undefined;
let callsInWindow = 0;
let windowStarted = Date.now();

function getRuntime(): Promise<Runtime> {
  runtimePromise ??= (async () => {
    const config = loadConfig();
    const documents = await loadDocuments(config.REPORTING_KNOWLEDGE_ROOT);
    const client = new ReportingClient(config);
    const jwks = config.OAUTH_JWKS_URL ? createRemoteJWKSet(new URL(config.OAUTH_JWKS_URL)) : undefined;
    return { config, documents, client, jwks };
  })();
  return runtimePromise;
}

export function createMcpServer(client: ReportingClient, documents: Map<string, string>): McpServer {
  const server = new McpServer(
    { name: "lightning-transport-reporting", version: "0.2.0" },
    {
      instructions:
        "This is a read-only Lightning reporting server. Use live report metadata before unfamiliar queries, never request SQL or mutations, and state source, filters, period, counts, pagination completeness, as_of, freshness limitations, and material caveats.",
    },
  );
  registerReportingView(server);
  registerTools(server, client, documents);
  return server;
}

function requestPath(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return url.split("?")[0] ?? "";
  }
}

export async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const bridgeUrl = new URL(request.url ?? "/", "https://lightning-reporting.vercel.app");
    if (await handleOAuthBridge(request, response, bridgeUrl)) return;
    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders());
      response.end();
      return;
    }
    const path = requestPath(request.url).replace(/\/+$/, "") || "/";
    if (path === "/health" && request.method === "GET") {
      return sendJson(response, 200, { status: "ok" });
    }
    const { config, documents, client, jwks } = await getRuntime();
    if (isProtectedResourceMetadataPath(path) && request.method === "GET") {
      if (config.MCP_AUTH_MODE !== "oauth") return sendJson(response, 404, { error: "OAuth is not enabled." });
      if (!config.OAUTH_AUDIENCE || !config.OAUTH_ISSUER) {
        return sendJson(response, 500, { error: "OAuth protected-resource metadata is not configured." });
      }
      return sendJson(response, 200, protectedResourceMetadata(config));
    }
    if (isAuthorizationServerDiscoveryPath(path) && request.method === "GET") {
      if (config.MCP_AUTH_MODE !== "oauth" || !config.OAUTH_ISSUER) {
        return sendJson(response, 404, { error: "OAuth is not enabled." });
      }
      return sendRedirect(response, authorizationServerDiscoveryUrl(config.OAUTH_ISSUER, path));
    }
    if (!path.startsWith("/mcp")) return sendJson(response, 404, { error: "Not found." });
    if (!rateLimit(config)) return sendJson(response, 429, { error: "Too many requests." });
    const auth = await authenticate(request, config, jwks);
    if (!auth.ok) return sendAuthChallenge(response, config, auth.message ?? "Authentication required.");

    const body = await readBody(request);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createMcpServer(client, documents);
    await server.connect(transport);
    await transport.handleRequest(request, response, body ? JSON.parse(body) : undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error.";
    if (!response.headersSent) sendJson(response, 500, { error: message });
    else response.end();
  }
}

const httpServer = createHttpServer((request, response) => {
  void handleRequest(request, response);
});

function rateLimit(config: Config): boolean {
  const now = Date.now();
  if (now - windowStarted >= 60_000) {
    windowStarted = now;
    callsInWindow = 0;
  }
  callsInWindow += 1;
  return callsInWindow <= config.MCP_RATE_LIMIT_RPM;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body too large."));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function isProtectedResourceMetadataPath(pathname: string): boolean {
  return (
    pathname === "/.well-known/oauth-protected-resource" ||
    pathname === "/.well-known/oauth-protected-resource/mcp" ||
    pathname === "/mcp/.well-known/oauth-protected-resource"
  );
}

function isAuthorizationServerDiscoveryPath(pathname: string): boolean {
  return pathname === "/.well-known/openid-configuration" || pathname === "/.well-known/oauth-authorization-server";
}

function canonicalMcpResource(config: Config): string {
  if (!config.OAUTH_AUDIENCE) {
    throw new Error("OAUTH_AUDIENCE is required to identify the MCP resource.");
  }
  return config.OAUTH_AUDIENCE;
}

function protectedResourceMetadata(config: Config) {
  if (!config.OAUTH_ISSUER) {
    throw new Error("OAUTH_ISSUER is required to publish protected-resource metadata.");
  }
  return {
    resource: canonicalMcpResource(config),
    authorization_servers: [config.OAUTH_ISSUER],
    scopes_supported: [config.OAUTH_SCOPE],
  };
}

function resourceMetadataUrl(config: Config): string {
  const resource = new URL(canonicalMcpResource(config));
  const resourcePath = resource.pathname.replace(/\/+$/, "");
  const suffix = !resourcePath || resourcePath === "/" ? "" : resourcePath;
  return `${resource.origin}/.well-known/oauth-protected-resource${suffix}`;
}

function authorizationServerDiscoveryUrl(issuer: string, pathname: string): string {
  const base = issuer.endsWith("/") ? issuer : `${issuer}/`;
  return new URL(pathname.replace(/^\//, ""), base).href;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { ...corsHeaders(), "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function sendRedirect(response: ServerResponse, location: string) {
  response.writeHead(302, { ...corsHeaders(), location, "cache-control": "no-store" });
  response.end();
}

function sendAuthChallenge(response: ServerResponse, config: Config, message: string) {
  const metadataUrl = config.OAUTH_AUDIENCE
    ? resourceMetadataUrl(config)
    : "/.well-known/oauth-protected-resource";
  response.writeHead(401, {
    ...corsHeaders(),
    "content-type": "application/json",
    "www-authenticate": `Bearer resource_metadata="${metadataUrl}", error="unauthorized", error_description="${message}"`,
  });
  response.end(JSON.stringify({ error: message }));
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, mcp-session-id",
    "access-control-expose-headers": "mcp-session-id",
  };
}

export default httpServer;
export { httpServer };
