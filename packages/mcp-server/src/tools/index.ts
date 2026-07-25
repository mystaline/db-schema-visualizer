import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  parseDDL,
  buildSchemaSql,
  buildPrismaSchema,
  buildDrizzleSchema,
  buildMermaidEr,
  buildGoStructs,
  parseGoStructs,
  normalizeImportedTable,
  type Schema,
} from "@schemaviz/core";
import { buildTsInterfaces, parseTsInterfaces } from "@schemaviz/core/ts";
import {
  SchemaInputSchema,
  LenientSchemaInputSchema,
  GoOptionsInputSchema,
  TsOptionsInputSchema,
} from "./schema.js";
import type { SchemaTable } from "@schemaviz/core";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function fail(e: unknown) {
  return {
    content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
    isError: true,
  };
}

/** Identity cast from the zod-inferred tool input shape to core's Schema type (structurally identical). */
function toCoreSchema(schema: z.infer<typeof SchemaInputSchema>): Schema {
  return schema;
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    "schema_to_go",
    {
      description: "Generate plain Go structs (configurable json/db tags, no ORM) from a SchemaViz schema.",
      inputSchema: { schema: SchemaInputSchema, options: GoOptionsInputSchema },
    },
    async ({ schema, options }) => {
      try {
        const { tables, foreignKeys } = toCoreSchema(schema);
        return ok(buildGoStructs(tables, foreignKeys, options));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "schema_to_ts",
    {
      description: "Generate TypeScript interfaces (API/wire-facing) from a SchemaViz schema.",
      inputSchema: { schema: SchemaInputSchema, options: TsOptionsInputSchema },
    },
    async ({ schema, options }) => {
      try {
        const { tables, foreignKeys } = toCoreSchema(schema);
        return ok(buildTsInterfaces(tables, foreignKeys, options));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "go_to_schema",
    {
      description: "Parse Go struct source into a SchemaViz schema (best-effort — see warnings for unsupported constructs).",
      inputSchema: { source: z.string() },
    },
    async ({ source }) => {
      try {
        return ok(parseGoStructs(source));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "ts_to_schema",
    {
      description: "Parse TypeScript interface source into a SchemaViz schema (best-effort — see warnings for unsupported constructs).",
      inputSchema: { source: z.string() },
    },
    async ({ source }) => {
      try {
        return ok(parseTsInterfaces(source));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "create_schema_from_json",
    {
      description: "Parse and normalize a SchemaViz JSON export (handles the legacy index shape) into a schema.",
      inputSchema: { json: z.string() },
    },
    async ({ json }) => {
      try {
        const parsed = JSON.parse(json);
        const validated = LenientSchemaInputSchema.parse(parsed);
        // normalizeImportedTable fills in the fields LenientSchemaTableSchema left
        // optional (checkConstraints, indexes' parts) — same runtime contract as
        // the legacy shape the app itself has always accepted from JSON.parse output.
        const tables = validated.tables.map((t) => normalizeImportedTable(t as unknown as SchemaTable));
        return ok({ tables, foreignKeys: validated.foreignKeys ?? [] });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "sql_to_schema",
    {
      description: "Parse Postgres DDL (CREATE TABLE/INDEX, ALTER TABLE ... FOREIGN KEY) into a SchemaViz schema.",
      inputSchema: { sql: z.string() },
    },
    async ({ sql }) => {
      try {
        return ok(parseDDL(sql));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "schema_to_sql",
    {
      description: "Generate Postgres DDL from a SchemaViz schema.",
      inputSchema: { schema: SchemaInputSchema },
    },
    async ({ schema }) => {
      try {
        const { tables, foreignKeys } = toCoreSchema(schema);
        const exportSet = new Set(tables.map((t) => t.id));
        const sql = buildSchemaSql(tables, foreignKeys, { exportSet, markCrossBoundary: false });
        return ok({ sql });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "schema_to_prisma",
    {
      description: "Generate a Prisma schema from a SchemaViz schema.",
      inputSchema: { schema: SchemaInputSchema },
    },
    async ({ schema }) => {
      try {
        const { tables, foreignKeys } = toCoreSchema(schema);
        return ok(buildPrismaSchema(tables, foreignKeys));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "schema_to_drizzle",
    {
      description: "Generate Drizzle ORM TypeScript schema code from a SchemaViz schema.",
      inputSchema: { schema: SchemaInputSchema },
    },
    async ({ schema }) => {
      try {
        const { tables, foreignKeys } = toCoreSchema(schema);
        return ok(buildDrizzleSchema(tables, foreignKeys));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "schema_to_mermaid",
    {
      description: "Generate a Mermaid ER diagram from a SchemaViz schema.",
      inputSchema: { schema: SchemaInputSchema },
    },
    async ({ schema }) => {
      try {
        const { tables, foreignKeys } = toCoreSchema(schema);
        return ok(buildMermaidEr(tables, foreignKeys));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
