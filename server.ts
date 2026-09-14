import { createServer } from "node:http";
import { handleRequest } from "./mcp-server/dist/server.js";

// Vercel Node.js backend captures createServer() + listen() in this file
// (https://vercel.com/docs/functions/runtimes/node-js). Importing a Server
// created in another module left production serving a static 500 page.
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  void handleRequest(request, response);
});

server.listen(Number(process.env.PORT ?? 8000));

export default server;
export { server as httpServer };
