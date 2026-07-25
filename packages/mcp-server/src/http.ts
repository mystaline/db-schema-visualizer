#!/usr/bin/env node
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools/index.js";

function createServer(): McpServer {
  const server = new McpServer({ name: "schemaviz-mcp", version: "0.1.0" });
  registerTools(server);
  return server;
}

const port = Number(process.env.PORT ?? 3000);

// Stateless mode: every tool here is a pure function with no session state,
// so — matching the MCP SDK's own recommended stateless pattern — a fresh
// McpServer + transport is created per request rather than sharing one
// long-lived transport across requests.
const httpServer = http.createServer((req, res) => {
  void (async () => {
    try {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res);
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (err) {
      console.error("[schemaviz-mcp] request handling error", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          }),
        );
      }
    }
  })();
});

httpServer.listen(port, () => {
  console.log(`[schemaviz-mcp] Streamable HTTP server listening on :${port}/`);
});
