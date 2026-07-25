import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools } from "./tools/index.js";

// Cloudflare Workers (and any other Web-Standard runtime) entrypoint —
// no node:http here, just a fetch(request) handler per the platform's own
// execution model. Same stateless-per-request pattern as http.ts: every
// tool is a pure function with no session state, and Workers isolates are
// short-lived per-request anyway, so there's nothing to gain from trying to
// share a server/transport instance across invocations.
export default {
  async fetch(request: Request): Promise<Response> {
    const server = new McpServer({ name: "schemaviz-mcp", version: "0.1.0" });
    registerTools(server);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    return transport.handleRequest(request);
  },
};
