// Types
export type {
  Schema,
  SchemaTable,
  Column,
  IndexPart,
  TableIndex,
  CheckConstraint,
  ForeignKey,
} from "./types";

// Legacy import migration (shared by the web app and the create_schema_from_json MCP tool)
export { migrateLegacyIndexes, normalizeImportedTable } from "./utils/legacyMigration";

// SQL
export { parseDDL } from "./parsers/sql/ddlParser";
export {
  buildSchemaSql,
  buildTableSql,
  hasBrokenRefs,
  countCrossBoundaryFks,
} from "./generators/sql/sqlExporter";
export type { BuildOptions } from "./generators/sql/sqlExporter";

// Prisma / Drizzle / Mermaid
export { buildPrismaSchema } from "./generators/prisma/prisma";
export type { PrismaResult } from "./generators/prisma/prisma";
export { buildDrizzleSchema, pgTypeToDrizzle } from "./generators/drizzle/drizzle";
export type { DrizzleResult, DrizzleTypeInfo } from "./generators/drizzle/drizzle";
export { buildMermaidEr } from "./generators/mermaid/mermaid";
export type { MermaidResult } from "./generators/mermaid/mermaid";

// Postgres type mapping (shared)
export { pgTypeToPrisma, pgTypeToMermaid, pgTypeToGo, goTypeToPg } from "./generators/shared/pgTypeMap";
export type { PrismaTypeInfo, GoTypeInfo, GoToPgResult } from "./generators/shared/pgTypeMap";

// Go
export { buildGoStructs } from "./generators/go/goGenerator";
export type { GoGeneratorOptions, GoGenerateResult, TagValueNaming } from "./generators/go/goGenerator";
export { parseGoStructs } from "./parsers/go/goToSchema";
export type { GoParseResult } from "./parsers/go/goToSchema";

// TS generator (safe for browser bundling — no heavy deps). The TS *parser*
// (parseTsInterfaces) is intentionally NOT exported here: it uses the
// TypeScript Compiler API, which is a multi-MB dependency that must not leak
// into the web app's bundle just because it imports this barrel. Import it
// from "@schemaviz/core/ts" instead (used by the MCP server / any consumer
// that actually needs types->schema parsing).
export { buildTsInterfaces } from "./generators/ts/tsGenerator";
export type { TsGeneratorOptions, TsGenerateResult } from "./generators/ts/tsGenerator";
export { pgTypeToTs, tsTypeToPg } from "./generators/shared/pgTypeMap";
export type { TsTypeInfo, TsToPgResult } from "./generators/shared/pgTypeMap";
