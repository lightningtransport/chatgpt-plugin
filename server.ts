import { httpServer } from "./mcp-server/src/server.js";

// Preferred Vercel entrypoint. Vercel captures this listen() call (the port is
// local-only; Vercel routes into the server). mcp-server skips listen() when
// VERCEL=1 so this file is the single bind on the platform.
httpServer.listen(Number(process.env.PORT ?? 8000));

export default httpServer;
export { httpServer };
