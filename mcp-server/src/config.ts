import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

function defaultKnowledgeRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, "AGENTS.md"))) return cwd;
  if (existsSync(join(cwd, "..", "AGENTS.md"))) return join(cwd, "..");
  return cwd;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  AGENT_REPORTING_ENDPOINT: z.string().url().default(
    "https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting",
  ),
  AGENT_REPORTING_KEY: z.string().min(1),
  REPORTING_KNOWLEDGE_ROOT: z.string().default(defaultKnowledgeRoot()),
  MCP_AUTH_MODE: z.enum(["development", "oauth"]).default("development"),
  OAUTH_ISSUER: z.string().url().optional(),
  OAUTH_AUDIENCE: z.string().url().optional(),
  OAUTH_JWKS_URL: z.string().url().optional(),
  OAUTH_SCOPE: z.string().default("reporting:read"),
  MCP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  MCP_RATE_LIMIT_RPM: z.coerce.number().int().min(1).max(600).default(60),
  MCP_MAX_PAGES: z.coerce.number().int().min(1).max(100).default(100),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = envSchema.parse(env);
  if (config.NODE_ENV === "production") {
    if (config.MCP_AUTH_MODE !== "oauth") {
      throw new Error("Production MCP server requires MCP_AUTH_MODE=oauth.");
    }
    if (!config.OAUTH_ISSUER || !config.OAUTH_AUDIENCE || !config.OAUTH_JWKS_URL) {
      throw new Error("Production OAuth requires OAUTH_ISSUER, OAUTH_AUDIENCE, and OAUTH_JWKS_URL.");
    }
  }
  return config;
}
