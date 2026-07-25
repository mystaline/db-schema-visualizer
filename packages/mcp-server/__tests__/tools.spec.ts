import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerTools } from "../src/tools/index.js";

async function setup() {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerTools(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

interface ToolTextResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

function jsonOf(result: ToolTextResult): any {
  const first = result.content[0];
  return JSON.parse(first.text);
}

const sampleSchema = {
  tables: [
    {
      id: "t1",
      name: "users",
      columns: [
        { id: "c1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "c2", name: "email", type: "text", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
      ],
      indexes: [],
      checkConstraints: [],
    },
  ],
  foreignKeys: [],
};

describe("mcp-server tools", () => {
  it("tools/list returns all 10 tools", async () => {
    const client = await setup();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "create_schema_from_json",
        "go_to_schema",
        "schema_to_drizzle",
        "schema_to_go",
        "schema_to_mermaid",
        "schema_to_prisma",
        "schema_to_sql",
        "schema_to_ts",
        "sql_to_schema",
        "ts_to_schema",
      ].sort(),
    );
  });

  it("schema_to_go generates a Go struct", async () => {
    const client = await setup();
    const result = (await client.callTool({ name: "schema_to_go", arguments: { schema: sampleSchema } })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.code).toContain("type User struct");
  });

  it("schema_to_go respects the tagValueNaming option", async () => {
    const client = await setup();
    const result = (await client.callTool({
      name: "schema_to_go",
      arguments: { schema: sampleSchema, options: { tagValueNaming: "tablePrefixed" } },
    })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.code).toContain('db:"users_id"');
  });

  it("schema_to_ts generates a TS interface", async () => {
    const client = await setup();
    const result = (await client.callTool({ name: "schema_to_ts", arguments: { schema: sampleSchema } })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.code).toContain("export interface User");
  });

  it("go_to_schema parses Go struct source", async () => {
    const client = await setup();
    const source = "type User struct {\n\tId string `db:\"id\"`\n}";
    const result = (await client.callTool({ name: "go_to_schema", arguments: { source } })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.tables[0].name).toBe("users");
  });

  it("ts_to_schema parses TS interface source", async () => {
    const client = await setup();
    const source = "interface User { id: string; }";
    const result = (await client.callTool({ name: "ts_to_schema", arguments: { source } })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.tables[0].name).toBe("users");
  });

  it("create_schema_from_json parses and normalizes JSON, migrating legacy index shape", async () => {
    const client = await setup();
    const json = JSON.stringify({
      tables: [
        {
          id: "t1",
          name: "users",
          columns: [],
          indexes: [{ id: "i1", name: "idx_a", type: "normal", columnIds: ["c1"] }],
        },
      ],
      foreignKeys: [],
    });
    const result = (await client.callTool({ name: "create_schema_from_json", arguments: { json } })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.tables[0].checkConstraints).toEqual([]);
    expect(data.tables[0].indexes[0].parts).toEqual([{ type: "column", value: "c1", order: "ASC" }]);
  });

  it("create_schema_from_json returns an MCP tool error for malformed JSON", async () => {
    const client = await setup();
    const result = (await client.callTool({ name: "create_schema_from_json", arguments: { json: "not json" } })) as ToolTextResult;
    expect(result.isError).toBe(true);
  });

  it("sql_to_schema parses DDL", async () => {
    const client = await setup();
    const sql = "CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL);";
    const result = (await client.callTool({ name: "sql_to_schema", arguments: { sql } })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.tables[0].name).toBe("users");
  });

  it("schema_to_sql generates CREATE TABLE DDL", async () => {
    const client = await setup();
    const result = (await client.callTool({ name: "schema_to_sql", arguments: { schema: sampleSchema } })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.sql).toContain('CREATE TABLE "users"');
  });

  it("schema_to_prisma generates a Prisma model", async () => {
    const client = await setup();
    const result = (await client.callTool({ name: "schema_to_prisma", arguments: { schema: sampleSchema } })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.schema).toContain("model User");
  });

  it("schema_to_drizzle generates a pgTable export", async () => {
    const client = await setup();
    const result = (await client.callTool({ name: "schema_to_drizzle", arguments: { schema: sampleSchema } })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.schema).toContain("pgTable(\"users\"");
  });

  it("schema_to_mermaid generates an erDiagram", async () => {
    const client = await setup();
    const result = (await client.callTool({ name: "schema_to_mermaid", arguments: { schema: sampleSchema } })) as ToolTextResult;
    const data = jsonOf(result);
    expect(data.diagram).toContain("erDiagram");
  });

  it("returns an MCP tool error (isError) for missing required input, not an uncaught exception", async () => {
    const client = await setup();
    const result = (await client.callTool({ name: "sql_to_schema", arguments: {} })) as ToolTextResult;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("sql");
  });
});
