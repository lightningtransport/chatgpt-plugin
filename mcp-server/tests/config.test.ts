import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("loads development mode without OAuth variables", () => {
    const config = loadConfig({
      NODE_ENV: "development",
      AGENT_REPORTING_KEY: "test-only-key",
      AGENT_REPORTING_ENDPOINT: "https://example.test/functions/v1/agent-reporting",
    });
    expect(config.MCP_AUTH_MODE).toBe("development");
    expect(config.OAUTH_SCOPE).toBe("reporting:read");
  });

  it("rejects production without OAuth", () => {
    expect(() => loadConfig({
      NODE_ENV: "production",
      MCP_AUTH_MODE: "development",
      AGENT_REPORTING_KEY: "test-only-key",
      AGENT_REPORTING_ENDPOINT: "https://example.test/functions/v1/agent-reporting",
    })).toThrow("Production MCP server requires MCP_AUTH_MODE=oauth.");
  });

  it("requires Auth0 issuer, audience, and JWKS in production", () => {
    expect(() => loadConfig({
      NODE_ENV: "production",
      MCP_AUTH_MODE: "oauth",
      AGENT_REPORTING_KEY: "test-only-key",
      AGENT_REPORTING_ENDPOINT: "https://example.test/functions/v1/agent-reporting",
    })).toThrow("Production OAuth requires OAUTH_ISSUER, OAUTH_AUDIENCE, and OAUTH_JWKS_URL.");
  });

  it("accepts Auth0 production configuration", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      MCP_AUTH_MODE: "oauth",
      AGENT_REPORTING_KEY: "test-only-key",
      AGENT_REPORTING_ENDPOINT: "https://example.test/functions/v1/agent-reporting",
      OAUTH_ISSUER: "https://dev-50ed1gzziwaws2zo.us.auth0.com/",
      OAUTH_AUDIENCE: "https://lightning-reporting.vercel.app/mcp",
      OAUTH_JWKS_URL: "https://dev-50ed1gzziwaws2zo.us.auth0.com/.well-known/jwks.json",
      OAUTH_SCOPE: "reporting:read",
    });
    expect(config.MCP_AUTH_MODE).toBe("oauth");
    expect(config.OAUTH_SCOPE).toBe("reporting:read");
    expect(config.OAUTH_ISSUER).toBe("https://dev-50ed1gzziwaws2zo.us.auth0.com/");
  });
});
