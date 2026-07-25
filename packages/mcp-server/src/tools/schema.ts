import { z } from "zod";

export const ColumnSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  isPrimaryKey: z.boolean(),
  isNullable: z.boolean(),
  isUnique: z.boolean(),
  defaultValue: z.string().nullable(),
});

export const IndexPartSchema = z.object({
  type: z.enum(["column", "expression"]),
  value: z.string(),
  order: z.enum(["ASC", "DESC"]).optional(),
});

export const TableIndexSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["normal", "unique"]),
  parts: z.array(IndexPartSchema),
  filter: z.string().optional(),
});

export const CheckConstraintSchema = z.object({
  id: z.string(),
  name: z.string(),
  expression: z.string(),
});

export const SchemaTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  columns: z.array(ColumnSchema),
  indexes: z.array(TableIndexSchema),
  checkConstraints: z.array(CheckConstraintSchema),
  notes: z.string().optional(),
});

export const ForeignKeySchema = z.object({
  id: z.string(),
  sourceTableId: z.string(),
  sourceColumnId: z.string(),
  targetTableId: z.string(),
  targetColumnId: z.string(),
  onDelete: z.enum(["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"]),
  onUpdate: z.enum(["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"]),
});

export const SchemaInputSchema = z.object({
  tables: z.array(SchemaTableSchema),
  foreignKeys: z.array(ForeignKeySchema),
});

// Looser variant for create_schema_from_json: the whole point of that tool is
// accepting legacy/incomplete JSON exports (missing checkConstraints, indexes
// using the old columnIds/expressions shape instead of parts) and normalizing
// them via normalizeImportedTable — so unlike SchemaInputSchema above, these
// fields must stay optional here rather than required.
export const LegacyIndexInputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["normal", "unique"]),
  parts: z.array(IndexPartSchema).optional(),
  filter: z.string().optional(),
  columnIds: z.array(z.string()).optional(),
  expressions: z.array(z.string()).optional(),
});

export const LenientSchemaTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  columns: z.array(ColumnSchema),
  indexes: z.array(LegacyIndexInputSchema).optional(),
  checkConstraints: z.array(CheckConstraintSchema).optional(),
  notes: z.string().optional(),
});

export const LenientSchemaInputSchema = z.object({
  tables: z.array(LenientSchemaTableSchema),
  foreignKeys: z.array(ForeignKeySchema).optional(),
});

// Go/TS generator options exposed over the wire — function-typed options
// (structNameStrategy, custom tagValueNaming, etc.) are JS-API-only and
// intentionally not exposable through a JSON tool schema; callers who need
// them use packages/core directly.
export const GoOptionsInputSchema = z
  .object({
    packageName: z.string().optional(),
    // Both flags required together when tags is provided — Partial<GoGeneratorOptions>
    // only makes the whole `tags` property optional, not its inner fields.
    tags: z.object({ json: z.boolean(), db: z.boolean() }).optional(),
    tagValueNaming: z.enum(["bare", "tablePrefixed"]).optional(),
    pointerForNullable: z.boolean().optional(),
  })
  .optional();

export const TsOptionsInputSchema = z
  .object({
    optionalForNullable: z.boolean().optional(),
    exportKeyword: z.boolean().optional(),
  })
  .optional();
