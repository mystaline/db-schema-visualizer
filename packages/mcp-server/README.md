# @schemaviz/mcp-server

An MCP (Model Context Protocol) server exposing SchemaViz's schema conversion
and codegen capabilities as tools, built on [`@schemaviz/core`](../core).

Every tool is a stateless pure function — no session state is kept between
calls — so the server ships with three entrypoints sharing the same tool
registration logic (`src/tools/index.ts`):

- **`stdio`** — for local use, spawned as a child process by an MCP client
  (e.g. Claude Code/Desktop-style config).
- **`http`** — a Streamable HTTP server for any Node-compatible host
  (a VPS, Fly.io/Render/Railway, Cloud Run, or Lambda via the
  [Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter)).
- **`worker`** — a Cloudflare Workers entrypoint (fetch-handler shape, no
  `node:http`) — see [Deploy to Cloudflare Workers](#deploy-to-cloudflare-workers) below.

## Tools

| Tool | Input | Description |
|---|---|---|
| `schema_to_go` | `{ schema, options? }` | Generate plain Go structs (configurable `json`/`db` tags, no ORM) |
| `schema_to_ts` | `{ schema, options? }` | Generate TypeScript interfaces (API/wire-facing) |
| `go_to_schema` | `{ source }` | Parse Go struct source into a schema |
| `ts_to_schema` | `{ source }` | Parse TS interface source into a schema |
| `create_schema_from_json` | `{ json }` | Parse/normalize a SchemaViz JSON export (handles legacy index shape) |
| `sql_to_schema` | `{ sql }` | Parse Postgres DDL into a schema |
| `schema_to_sql` | `{ schema }` | Generate Postgres DDL |
| `schema_to_prisma` | `{ schema }` | Generate a Prisma schema |
| `schema_to_drizzle` | `{ schema }` | Generate Drizzle ORM TS schema code |
| `schema_to_mermaid` | `{ schema }` | Generate a Mermaid ER diagram |

`schema_to_go`'s `options.tagValueNaming` accepts `"bare"` (default, e.g.
`json:"id"`) or `"tablePrefixed"` (e.g. `json:"users_id"`, pluralized table
name + column name) — the two JSON-serializable presets. A fully custom
naming function is also supported by `buildGoStructs` in `@schemaviz/core`
directly, but isn't exposable over a JSON tool schema.

Go/TS reverse parsing (`go_to_schema`, `ts_to_schema`) is best-effort — see
[`packages/core/README.md`](../core/README.md) for the full list of
unsupported constructs. Every tool returns a JSON payload with a `warnings`
array (or similar) documenting anything that couldn't be represented exactly.

## Build

```sh
pnpm --filter @schemaviz/mcp-server build
```

This bundles `src/stdio.ts` and `src/http.ts` with esbuild into
`dist/stdio.js` / `dist/http.js`. Bundling (rather than a plain `tsc` build)
is required here: `@schemaviz/core`'s package.json points its `import`
condition straight at raw `.ts` source (no build step, for fast Vite/Vitest
consumption elsewhere in the monorepo) using extension-less relative
imports — which Vite/esbuild resolve bundler-style, but plain `node` cannot
resolve at all under native ESM rules. Bundling `@schemaviz/core` into this
package's own output sidesteps that without requiring every internal import
across `packages/core` to carry an explicit `.js` extension.
`@modelcontextprotocol/sdk`, `zod`, and `typescript` stay external (real
`node_modules` dependencies at runtime, not bundled).

## Run

**Local (stdio)** — after building:

```sh
node dist/stdio.js
```

Or configure an MCP client to spawn it directly, e.g. in a client's MCP
config:

```json
{
  "mcpServers": {
    "schemaviz": {
      "command": "node",
      "args": ["/path/to/db-schema-visualizer/packages/mcp-server/dist/stdio.js"]
    }
  }
}
```

Once published to npm, the equivalent would be:

```json
{
  "mcpServers": {
    "schemaviz": {
      "command": "npx",
      "args": ["-y", "@schemaviz/mcp-server"]
    }
  }
}
```

**Hosted (Streamable HTTP)**:

```sh
PORT=3000 node dist/http.js
```

Point an MCP client that supports the Streamable HTTP transport at
`http://host:3000/`. The server runs in stateless mode (a fresh internal
`McpServer`/transport pair per request, per the MCP SDK's own recommended
stateless pattern) — no session cookies/headers are required or issued.

## Deploy to Cloudflare Workers

`src/worker.ts` uses the MCP SDK's `WebStandardStreamableHTTPServerTransport`
(Fetch API `Request`/`Response`, not `node:http`) and exports a plain
`fetch(request)` handler — Workers' native shape, not a listening server.
Same stateless-per-request design as `http.ts`.

```sh
pnpm --filter @schemaviz/mcp-server build:worker   # -> dist/worker.js
pnpm --filter @schemaviz/mcp-server dev:worker      # wrangler dev, local verification
pnpm --filter @schemaviz/mcp-server deploy          # builds, then wrangler deploy
```

Bundle size was measured, not assumed: `typescript` (needed only by
`ts_to_schema`) is the largest dependency at 8.7MB uncompressed, but its
Node-builtin-touching code paths (`fs`/`os`/`path`/`perf_hooks`, used only by
its CLI/tracing machinery — never by `ts.createSourceFile`, which is all
`parseTsInterfaces` calls) are marked `--external` in `build:worker` so
esbuild doesn't choke on resolving them, and are simply never reached at
runtime. The full bundle — SDK, zod, `@schemaviz/core`, `typescript`, and
all — comes to **~1.7MB gzip-compressed**, comfortably under Cloudflare's
3MB free-tier script size limit. Verified locally with `wrangler dev`,
including an actual `ts_to_schema` call exercising the bundled compiler.

**What's on you, not this repo:**
- **Authentication** — `wrangler deploy` needs `wrangler login` (interactive
  OAuth) or a `CLOUDFLARE_API_TOKEN` env var. Neither is configured here.
- **Custom domain** — `wrangler.toml` ships with a commented-out `[[routes]]`
  block using the same `pattern` + `custom_domain = true` shape already used
  in `mail-worker`'s `wrangler.toml` for `mail.mystaline.dev` — uncomment and
  point it at whatever subdomain you want (a suggested `mcp.mystaline.dev`
  is filled in), or map it after deploying via the Cloudflare dashboard
  (Workers & Pages → this worker → Triggers → Custom Domains). Without
  either, it's reachable at the default
  `schemaviz-mcp.<your-subdomain>.workers.dev`.
- **`compatibility_date`** — set conservatively (`2024-01-01`, matching
  `mail-worker`'s convention) since it can't be in the future relative to
  Cloudflare's clock; bump it if you want newer runtime behavior. No
  `nodejs_compat` flag either — verified locally that nothing here needs it,
  also matching `mail-worker`.

## Test

```sh
pnpm --filter @schemaviz/mcp-server test
```

Covers every tool via the MCP SDK's in-memory client/server transport pair
(exercising real zod input validation and MCP error shaping, not just
calling handler functions directly), plus a smoke test that spawns the
actual built `dist/stdio.js` binary and confirms `tools/list` returns all 10
tools over real stdio JSON-RPC.
