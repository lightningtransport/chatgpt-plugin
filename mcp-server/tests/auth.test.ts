import type { IncomingMessage } from "node:http";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { describe, expect, it } from "vitest";
import { authenticate, collectGrantedScopes } from "../src/auth.js";
import type { Config } from "../src/config.js";

const ISSUER = "https://dev-50ed1gzziwaws2zo.us.auth0.com/";
const AUDIENCE = "https://lightning-reporting.vercel.app/mcp";

function oauthConfig(overrides: Partial<Config> = {}): Config {
  return {
    NODE_ENV: "test",
    PORT: 8000,
    AGENT_REPORTING_ENDPOINT: "https://example.test/functions/v1/agent-reporting",
    AGENT_REPORTING_KEY: "test-only-key",
    REPORTING_KNOWLEDGE_ROOT: "/tmp",
    MCP_AUTH_MODE: "oauth",
    OAUTH_ISSUER: ISSUER,
    OAUTH_AUDIENCE: AUDIENCE,
    OAUTH_JWKS_URL: `${ISSUER}.well-known/jwks.json`,
    OAUTH_SCOPE: "reporting:read",
    MCP_REQUEST_TIMEOUT_MS: 30_000,
    MCP_RATE_LIMIT_RPM: 60,
    MCP_MAX_PAGES: 100,
    ...overrides,
  };
}

function authRequest(authorization?: string): IncomingMessage {
  return { headers: authorization ? { authorization } : {} } as IncomingMessage;
}

async function testKeys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  return {
    privateKey,
    jwks: createLocalJWKSet({ keys: [jwk] }),
  };
}

async function signToken(
  privateKey: CryptoKey,
  claims: JWTPayload,
  options: { audience?: string | string[]; issuer?: string; subject?: string } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setSubject(options.subject ?? "auth0|user-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

describe("collectGrantedScopes", () => {
  it("reads space-delimited scope, scp array, and permissions array", () => {
    expect(collectGrantedScopes({ scope: "openid reporting:read" })).toEqual(["openid", "reporting:read"]);
    expect(collectGrantedScopes({ scp: ["reporting:read"] })).toEqual(["reporting:read"]);
    expect(collectGrantedScopes({ permissions: ["reporting:read"] })).toEqual(["reporting:read"]);
  });

  it("unions all claim sources", () => {
    expect(
      collectGrantedScopes({
        scope: "openid",
        scp: ["profile"],
        permissions: ["reporting:read"],
      }).sort(),
    ).toEqual(["openid", "profile", "reporting:read"]);
  });

  it("ignores empty and non-string values", () => {
    expect(collectGrantedScopes({ scope: "  ", scp: [1, ""], permissions: null })).toEqual([]);
  });
});

describe("authenticate", () => {
  it("accepts a verified JWT whose permissions include OAUTH_SCOPE", async () => {
    const { privateKey, jwks } = await testKeys();
    const token = await signToken(privateKey, { permissions: ["reporting:read"] });
    await expect(authenticate(authRequest(`Bearer ${token}`), oauthConfig(), jwks)).resolves.toEqual({ ok: true });
  });

  it("accepts space-delimited scope or RFC 9068 scp", async () => {
    const { privateKey, jwks } = await testKeys();
    const scopeToken = await signToken(privateKey, { scope: "openid reporting:read" });
    const scpToken = await signToken(privateKey, { scp: ["reporting:read"] });
    await expect(authenticate(authRequest(`Bearer ${scopeToken}`), oauthConfig(), jwks)).resolves.toEqual({ ok: true });
    await expect(authenticate(authRequest(`Bearer ${scpToken}`), oauthConfig(), jwks)).resolves.toEqual({ ok: true });
  });

  it("rejects a verified JWT that lacks the required scope", async () => {
    const { privateKey, jwks } = await testKeys();
    const token = await signToken(privateKey, { permissions: ["other:permission"], scope: "openid" });
    await expect(authenticate(authRequest(`Bearer ${token}`), oauthConfig(), jwks)).resolves.toEqual({
      ok: false,
      message: "Required reporting scope is missing.",
    });
  });

  it("rejects a missing bearer without treating it as a bad JWT", async () => {
    const { jwks } = await testKeys();
    await expect(authenticate(authRequest(), oauthConfig(), jwks)).resolves.toEqual({
      ok: false,
      message: "Missing bearer token.",
    });
    await expect(authenticate(authRequest("Bearer "), oauthConfig(), jwks)).resolves.toEqual({
      ok: false,
      message: "Missing bearer token.",
    });
  });

  it("rejects an unverifiable JWT without leaking token values", async () => {
    const { jwks } = await testKeys();
    const result = await authenticate(authRequest("Bearer not-a-jwt"), oauthConfig(), jwks);
    expect(result).toEqual({ ok: false, message: "Invalid or unverifiable access token." });
    expect(JSON.stringify(result)).not.toMatch(/not-a-jwt/);
  });

  it("rejects a JWT with the wrong audience", async () => {
    const { privateKey, jwks } = await testKeys();
    const token = await signToken(privateKey, { permissions: ["reporting:read"] }, { audience: "https://other.example/mcp" });
    await expect(authenticate(authRequest(`Bearer ${token}`), oauthConfig(), jwks)).resolves.toEqual({
      ok: false,
      message: "Invalid or unverifiable access token.",
    });
  });
});
