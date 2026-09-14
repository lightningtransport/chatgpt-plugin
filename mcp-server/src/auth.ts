import type { IncomingMessage } from "node:http";
import { jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { Config } from "./config.js";

export function collectGrantedScopes(payload: JWTPayload): string[] {
  const granted = new Set<string>();
  addScopeValues(granted, payload.scope);
  addScopeValues(granted, payload.scp);
  addScopeValues(granted, payload.permissions);
  return [...granted];
}

function addScopeValues(granted: Set<string>, value: unknown): void {
  if (typeof value === "string") {
    for (const part of value.split(/\s+/)) {
      if (part) granted.add(part);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const part of value) {
      if (typeof part === "string" && part) granted.add(part);
    }
  }
}

export async function authenticate(
  request: IncomingMessage,
  config: Config,
  jwks: JWTVerifyGetKey | undefined,
): Promise<{ ok: boolean; message?: string }> {
  if (config.MCP_AUTH_MODE === "development") return { ok: true };
  if (!jwks || !config.OAUTH_ISSUER || !config.OAUTH_AUDIENCE) {
    return { ok: false, message: "Authentication required." };
  }
  const value = request.headers.authorization;
  if (!value?.startsWith("Bearer ") || !value.slice("Bearer ".length).trim()) {
    return { ok: false, message: "Missing bearer token." };
  }
  try {
    const verified = await jwtVerify(value.slice("Bearer ".length).trim(), jwks, {
      issuer: config.OAUTH_ISSUER,
      audience: config.OAUTH_AUDIENCE,
      requiredClaims: ["sub"],
    });
    const scopes = collectGrantedScopes(verified.payload);
    if (!scopes.includes(config.OAUTH_SCOPE)) {
      return { ok: false, message: "Required reporting scope is missing." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Invalid or unverifiable access token." };
  }
}
