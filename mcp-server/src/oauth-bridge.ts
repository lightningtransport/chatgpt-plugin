import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const base = "https://lightning-reporting.vercel.app";
const bridgeIssuer = `${base}/oauth`;
const issuer = "https://dev-50ed1gzziwaws2zo.us.auth0.com/";
const clientId = process.env.OAUTH_BRIDGE_CLIENT_ID;
const secret = process.env.OAUTH_BRIDGE_SECRET;
const callback = `${base}/oauth/callback`;

function pack(value: unknown) { const body = Buffer.from(JSON.stringify(value)).toString("base64url"); const sig = createHmac("sha256", secret!).update(body).digest("base64url"); return `${body}.${sig}`; }
function unpack(value: string) { const [body, sig] = value.split("."); if (!body || !sig) throw new Error("Invalid OAuth state."); const expected = createHmac("sha256", secret!).update(body).digest("base64url"); if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error("Invalid OAuth state."); return JSON.parse(Buffer.from(body, "base64url").toString()); }
function send(res: ServerResponse, code: number, body: unknown) { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); }
function form(req: IncomingMessage) { return new Promise<Record<string,string>>((resolve) => { let b=""; req.on("data", c => b += c); req.on("end", () => resolve(Object.fromEntries(new URLSearchParams(b)))); }); }

export async function handleOAuthBridge(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (!url.pathname.startsWith("/oauth/")) return false;
  if (!clientId || !secret) { send(res, 503, { error: "OAuth bridge is not configured." }); return true; }
  if (url.pathname === "/oauth/.well-known/openid-configuration" || url.pathname === "/oauth/.well-known/oauth-authorization-server") { send(res, 200, { issuer: bridgeIssuer, authorization_endpoint: `${bridgeIssuer}/authorize`, token_endpoint: `${bridgeIssuer}/token`, jwks_uri: `${issuer}.well-known/jwks.json`, client_id_metadata_document_supported: true, token_endpoint_auth_methods_supported: ["none"], code_challenge_methods_supported: ["S256"], authorization_response_iss_parameter_supported: true }); return true; }
  if (url.pathname === "/oauth/authorize") {
    const state = pack({ state: url.searchParams.get("state"), redirect: url.searchParams.get("redirect_uri"), challenge: url.searchParams.get("code_challenge"), resource: url.searchParams.get("resource") });
    const target = new URL("authorize", issuer); target.searchParams.set("response_type", "code"); target.searchParams.set("client_id", clientId); target.searchParams.set("redirect_uri", callback); target.searchParams.set("scope", "openid profile email offline_access reporting:read"); target.searchParams.set("code_challenge", url.searchParams.get("code_challenge") ?? ""); target.searchParams.set("code_challenge_method", "S256"); target.searchParams.set("audience", url.searchParams.get("resource") ?? `${base}/mcp`); target.searchParams.set("state", state); res.writeHead(302, { location: target.href }); res.end(); return true;
  }
  if (url.pathname === "/oauth/callback") { try { const p = unpack(url.searchParams.get("state") ?? ""); const out = new URL(p.redirect); out.searchParams.set("code", pack({ upstream: url.searchParams.get("code"), ...p })); if (p.state) out.searchParams.set("state", p.state); out.searchParams.set("iss", bridgeIssuer); res.writeHead(302, { location: out.href }); res.end(); } catch { send(res, 400, { error: "Invalid OAuth callback." }); } return true; }
  if (url.pathname === "/oauth/token" && req.method === "POST") { try { const body = await form(req); const p = unpack(body.code ?? ""); const upstream = await fetch(new URL("oauth/token", issuer), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code: p.upstream, redirect_uri: callback, code_verifier: body.code_verifier ?? "" }) }); res.writeHead(upstream.status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(await upstream.text()); } catch { send(res, 400, { error: "Invalid OAuth token request." }); } return true; }
  send(res, 404, { error: "Not found." }); return true;
}
