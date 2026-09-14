import { httpServer } from "./server.js";

const port = Number(process.env.PORT ?? 8000);
httpServer.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "mcp_server_started", port, endpoint: "/mcp" }));
});
