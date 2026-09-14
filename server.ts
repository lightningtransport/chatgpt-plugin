import { createServer } from "node:http";

// Vercel captures createServer() + listen() in this file.
// Do not import mcp-server at module load: a boot failure would 500 /health too.
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  void import("./mcp-server/dist/server.js")
    .then(({ handleRequest }) => handleRequest(request, response))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Internal server error.";
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json", "cache-control": "no-store" });
        response.end(JSON.stringify({ error: message }));
      } else {
        response.end();
      }
    });
});

server.listen(Number(process.env.PORT ?? 8000));

export default server;
export { server as httpServer };
