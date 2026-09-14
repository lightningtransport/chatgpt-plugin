import { createServer } from "node:http";

// Official Vercel Node.js pattern: createServer + listen(PORT) in this file,
// no export default (dual listen/export hung the worker for 60s).
const server = createServer((request, response) => {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  void import("./mcp-server/src/server.js")
    .then(({ handleRequest }) => handleRequest(request, response))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Internal server error.";
      if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: message }));
      } else {
        response.end();
      }
    });
});

server.listen(Number(process.env.PORT ?? 8000));
