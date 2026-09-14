import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.MCP_AUTH_MODE = "oauth";
process.env.AGENT_REPORTING_KEY = "test-only-key";
process.env.AGENT_REPORTING_ENDPOINT = "https://example.test/functions/v1/agent-reporting";
process.env.OAUTH_ISSUER = "https://example.auth0.com/";
process.env.OAUTH_AUDIENCE = "https://example.vercel.app";
process.env.OAUTH_JWKS_URL = "https://example.auth0.com/.well-known/jwks.json";
process.env.OAUTH_SCOPE = "reporting:read";

const { httpServer } = await import("../src/server.js");

function request(path: string, method = "GET"): Promise<{ status: number; headers: Headers; body: string }> {
  return new Promise((resolve, reject) => {
    const address = httpServer.address();
    if (!address || typeof address === "string") {
      reject(new Error("Server is not listening."));
      return;
    }
    fetch(`http://127.0.0.1:${address.port}${path}`, { method })
      .then(async (response) => {
        resolve({
          status: response.status,
          headers: response.headers,
          body: await response.text(),
        });
      })
      .catch(reject);
  });
}

describe("HTTP endpoints", () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves /health", async () => {
    const response = await request("/health");
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: "ok" });
  });

  it("publishes OAuth protected-resource metadata", async () => {
    const response = await request("/.well-known/oauth-protected-resource");
    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as {
      authorization_servers: string[];
      scopes_supported: string[];
    };
    expect(body.authorization_servers).toEqual(["https://example.auth0.com/"]);
    expect(body.scopes_supported).toEqual(["reporting:read"]);
  });

  it("challenges unauthenticated /mcp requests", async () => {
    const response = await request("/mcp", "POST");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("oauth-protected-resource");
  });
});
