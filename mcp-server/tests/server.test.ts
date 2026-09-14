import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.MCP_AUTH_MODE = "oauth";
process.env.AGENT_REPORTING_KEY = "test-only-key";
process.env.AGENT_REPORTING_ENDPOINT = "https://example.test/functions/v1/agent-reporting";
process.env.OAUTH_ISSUER = "https://dev-50ed1gzziwaws2zo.us.auth0.com/";
process.env.OAUTH_AUDIENCE = "https://lightning-reporting.vercel.app/mcp";
process.env.OAUTH_JWKS_URL = "https://dev-50ed1gzziwaws2zo.us.auth0.com/.well-known/jwks.json";
process.env.OAUTH_SCOPE = "reporting:read";

const { httpServer } = await import("../src/server.js");

function request(path: string, method = "GET"): Promise<{ status: number; headers: Headers; body: string }> {
  return new Promise((resolve, reject) => {
    const address = httpServer.address();
    if (!address || typeof address === "string") {
      reject(new Error("Server is not listening."));
      return;
    }
    fetch(`http://127.0.0.1:${address.port}${path}`, { method, redirect: "manual" })
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

  it("serves /health without reporting env", async () => {
    const previous = process.env.AGENT_REPORTING_KEY;
    delete process.env.AGENT_REPORTING_KEY;
    try {
      const response = await request("/health");
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: "ok" });
    } finally {
      process.env.AGENT_REPORTING_KEY = previous;
    }
  });

  it("publishes OAuth protected-resource metadata using OAUTH_AUDIENCE", async () => {
    const response = await request("/.well-known/oauth-protected-resource");
    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as {
      resource: string;
      authorization_servers: string[];
      scopes_supported: string[];
    };
    expect(body.resource).toBe("https://lightning-reporting.vercel.app/mcp");
    expect(body.authorization_servers).toEqual(["https://dev-50ed1gzziwaws2zo.us.auth0.com/"]);
    expect(body.scopes_supported).toEqual(["reporting:read"]);
  });

  it("publishes the same metadata at the RFC 9728 path-aware URL", async () => {
    const response = await request("/.well-known/oauth-protected-resource/mcp");
    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as { resource: string };
    expect(body.resource).toBe("https://lightning-reporting.vercel.app/mcp");
  });

  it("redirects authorization-server discovery probes to Auth0", async () => {
    const oidc = await request("/.well-known/openid-configuration");
    expect(oidc.status).toBe(302);
    expect(oidc.headers.get("location")).toBe(
      "https://dev-50ed1gzziwaws2zo.us.auth0.com/.well-known/openid-configuration",
    );

    const oauth = await request("/.well-known/oauth-authorization-server");
    expect(oauth.status).toBe(302);
    expect(oauth.headers.get("location")).toBe(
      "https://dev-50ed1gzziwaws2zo.us.auth0.com/.well-known/oauth-authorization-server",
    );
  });

  it("challenges unauthenticated /mcp requests with a matching resource_metadata URL", async () => {
    const response = await request("/mcp", "POST");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'resource_metadata="https://lightning-reporting.vercel.app/.well-known/oauth-protected-resource/mcp"',
    );
  });
});
