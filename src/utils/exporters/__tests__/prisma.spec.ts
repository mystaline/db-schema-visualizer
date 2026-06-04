import { describe, it, expect } from "vitest";
import { buildPrismaSchema } from "../prisma";
import type { Table, ForeignKey } from "../../../stores/schemaStore";

// ---- helpers ----

const mkTable = (overrides: Partial<Table> = {}): Table => ({
  id: "t1",
  name: "users",
  x: 0,
  y: 0,
  columns: [],
  indexes: [],
  checkConstraints: [],
  ...overrides,
});

const mkFk = (overrides: Partial<ForeignKey> = {}): ForeignKey => ({
  id: "fk1",
  sourceTableId: "t2",
  sourceColumnId: "c_fk",
  targetTableId: "t1",
  targetColumnId: "c_id",
  onDelete: "NO ACTION",
  onUpdate: "NO ACTION",
  ...overrides,
});

const col = (
  id: string,
  name: string,
  type: string,
  opts: Partial<{ isPrimaryKey: boolean; isNullable: boolean; isUnique: boolean; defaultValue: string | null }> = {},
) => ({
  id,
  name,
  type,
  isPrimaryKey: false,
  isNullable: true,
  isUnique: false,
  defaultValue: null,
  ...opts,
});

// ---- buildPrismaSchema ----

describe("buildPrismaSchema", () => {
  it("returns a schema string and warnings array", () => {
    const { schema, warnings } = buildPrismaSchema([], []);
    expect(typeof schema).toBe("string");
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("includes SchemaViz header comment", () => {
    const { schema } = buildPrismaSchema([], []);
    expect(schema).toContain("SchemaViz");
  });

  it("includes generator client block", () => {
    const { schema } = buildPrismaSchema([], []);
    expect(schema).toContain('generator client');
    expect(schema).toContain('provider = "prisma-client-js"');
  });

  it("includes datasource db block with postgresql provider", () => {
    const { schema } = buildPrismaSchema([], []);
    expect(schema).toContain('datasource db');
    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain('env("DATABASE_URL")');
  });

  it("emits model block with PascalCase name", () => {
    const t = mkTable({ name: "user_accounts", columns: [col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("model UserAccounts {");
  });

  it("emits @@map when model name differs from table name", () => {
    const t = mkTable({ name: "users", columns: [col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain('@@map("users")');
  });

  it("omits @@map when model name equals table name", () => {
    const t = mkTable({ name: "Users", columns: [col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).not.toContain("@@map");
  });

  it("converts snake_case column to camelCase field with @map", () => {
    const t = mkTable({ columns: [col("c1", "created_at", "timestamp")] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("createdAt");
    expect(schema).toContain('@map("created_at")');
  });

  it("omits field-level @map when field name equals column name", () => {
    const t = mkTable({ columns: [col("c1", "email", "text")] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).not.toContain('@map("email")');
  });

  it("appends ? for nullable fields", () => {
    const t = mkTable({ columns: [col("c1", "bio", "text", { isNullable: true })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toMatch(/bio\s+String\?/);
  });

  it("does not append ? for non-nullable fields", () => {
    const t = mkTable({ columns: [col("c1", "email", "text", { isNullable: false })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toMatch(/email\s+String[^?]/);
  });

  it("emits @id for single-column primary key", () => {
    const t = mkTable({ columns: [col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@id");
  });

  it("emits @@id for composite primary key", () => {
    const t = mkTable({
      columns: [
        col("c1", "project_id", "integer", { isPrimaryKey: true, isNullable: false }),
        col("c2", "user_id", "integer", { isPrimaryKey: true, isNullable: false }),
      ],
    });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@@id([projectId, userId])");
    expect(schema).not.toContain(" @id");
  });

  it("emits @default(autoincrement()) for serial primary key", () => {
    const t = mkTable({ columns: [col("c1", "id", "serial", { isPrimaryKey: true, isNullable: false })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@default(autoincrement())");
  });

  it("emits @unique for unique non-PK column", () => {
    const t = mkTable({ columns: [col("c1", "email", "text", { isUnique: true })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@unique");
  });

  it("emits @default with numeric literal", () => {
    const t = mkTable({ columns: [col("c1", "count", "integer", { defaultValue: "0" })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@default(0)");
  });

  it("emits @default with string literal", () => {
    const t = mkTable({ columns: [col("c1", "status", "text", { defaultValue: "'active'" })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain('@default("active")');
  });

  it("emits @default(now()) for now() default", () => {
    const t = mkTable({ columns: [col("c1", "created_at", "timestamp", { defaultValue: "now()" })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@default(now())");
  });

  it("emits @default(uuid()) for gen_random_uuid() default", () => {
    const t = mkTable({ columns: [col("c1", "id", "uuid", { defaultValue: "gen_random_uuid()" })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@default(uuid())");
  });

  it("uses dbgenerated() for PostgreSQL cast expressions", () => {
    const t = mkTable({ columns: [col("c1", "meta", "jsonb", { defaultValue: "'{}'::jsonb" })] });
    const { schema, warnings } = buildPrismaSchema([t], []);
    expect(schema).toContain(`@default(dbgenerated("'{}'::jsonb"))`);
    expect(warnings.some((w) => w.toLowerCase().includes("default"))).toBe(false);
  });

  it("uses dbgenerated() for arbitrary SQL expression defaults", () => {
    const t = mkTable({ columns: [col("c1", "token", "text", { defaultValue: "md5(random()::text)" })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain('@default(dbgenerated("md5(random()::text)"))');
  });

  it("emits relation field on source side of FK", () => {
    const users = mkTable({ id: "t1", name: "users", columns: [col("c_id", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const posts = mkTable({ id: "t2", name: "posts", columns: [col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false }), col("c_fk", "user_id", "integer", { isNullable: false })] });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { schema } = buildPrismaSchema([users, posts], [fk]);
    expect(schema).toContain("@relation(fields: [userId], references: [id])");
  });

  it("emits back-relation field on target side of FK", () => {
    const users = mkTable({ id: "t1", name: "users", columns: [col("c_id", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const posts = mkTable({ id: "t2", name: "posts", columns: [col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false }), col("c_fk", "user_id", "integer")] });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { schema } = buildPrismaSchema([users, posts], [fk]);
    expect(schema).toContain("Posts[]");
  });

  it("back-relation is Model? for one-to-one (FK col is unique)", () => {
    const users = mkTable({ id: "t1", name: "users", columns: [col("c_id", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const profiles = mkTable({ id: "t2", name: "profiles", columns: [col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false }), col("c_fk", "user_id", "integer", { isUnique: true, isNullable: false })] });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { schema } = buildPrismaSchema([users, profiles], [fk]);
    expect(schema).toContain("Profiles?");
  });

  it("uses named relations when two FKs exist between the same table pair", () => {
    const users = mkTable({ id: "t1", name: "users", columns: [col("c_id", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const posts = mkTable({
      id: "t2", name: "posts",
      columns: [
        col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false }),
        col("c2", "author_id", "integer"),
        col("c3", "reviewer_id", "integer", { isNullable: true }),
      ],
    });
    const fk1 = mkFk({ id: "fk1", sourceTableId: "t2", sourceColumnId: "c2", targetTableId: "t1", targetColumnId: "c_id" });
    const fk2 = mkFk({ id: "fk2", sourceTableId: "t2", sourceColumnId: "c3", targetTableId: "t1", targetColumnId: "c_id" });
    const { schema } = buildPrismaSchema([users, posts], [fk1, fk2]);
    expect(schema).toMatch(/@relation\("[^"]+"/);
  });

  it("handles self-referential FK with named relation", () => {
    const employees = mkTable({
      id: "t1", name: "employees",
      columns: [
        col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false }),
        col("c2", "manager_id", "integer", { isNullable: true }),
      ],
    });
    const fk = mkFk({ id: "fk1", sourceTableId: "t1", sourceColumnId: "c2", targetTableId: "t1", targetColumnId: "c1" });
    const { schema } = buildPrismaSchema([employees], [fk]);
    expect(schema).toMatch(/@relation\("[^"]+"/);
    expect(schema).toContain("Employees[]");
  });

  it("emits @@index for regular index", () => {
    const t = mkTable({
      columns: [col("c1", "email", "text")],
      indexes: [{ id: "i1", name: "idx_email", type: "normal", parts: [{ type: "column", value: "c1" }] }],
    });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@@index([email])");
  });

  it("emits @@unique for unique index", () => {
    const t = mkTable({
      columns: [col("c1", "slug", "text")],
      indexes: [{ id: "i1", name: "idx_slug", type: "unique", parts: [{ type: "column", value: "c1" }] }],
    });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@@unique([slug])");
  });

  it("suppresses @@unique for single-column unique index when column already has @unique", () => {
    const t = mkTable({
      columns: [col("c1", "email", "text", { isUnique: true })],
      indexes: [{ id: "i1", name: "idx_email", type: "unique", parts: [{ type: "column", value: "c1" }] }],
    });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@unique");         // field-level @unique stays
    expect(schema).not.toContain("@@unique");    // table-level @@unique suppressed
  });

  it("keeps @@unique for multi-column unique index even if one column has @unique", () => {
    const t = mkTable({
      columns: [col("c1", "a", "text", { isUnique: true }), col("c2", "b", "text")],
      indexes: [{ id: "i1", name: "idx_ab", type: "unique", parts: [{ type: "column", value: "c1" }, { type: "column", value: "c2" }] }],
    });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@@unique([a, b])");
  });

  it("skips expression indexes with a warning", () => {
    const t = mkTable({
      columns: [col("c1", "email", "text")],
      indexes: [{ id: "i1", name: "idx_lower", type: "normal", parts: [{ type: "expression", value: "lower(email)" }] }],
    });
    const { schema, warnings } = buildPrismaSchema([t], []);
    expect(schema).not.toContain("@@index");
    expect(warnings.some((w) => w.includes("idx_lower"))).toBe(true);
  });

  it("skips CHECK constraints with a warning", () => {
    const t = mkTable({
      columns: [col("c1", "age", "integer")],
      checkConstraints: [{ id: "ck1", name: "age_check", expression: "age > 0" }],
    });
    const { schema, warnings } = buildPrismaSchema([t], []);
    expect(schema).not.toContain("age_check");
    expect(warnings.some((w) => w.includes("age_check"))).toBe(true);
  });

  it("maps unsupported types to Unsupported(...) with a warning", () => {
    const t = mkTable({ columns: [col("c1", "addr", "cidr")] });
    const { schema, warnings } = buildPrismaSchema([t], []);
    expect(schema).toContain('Unsupported("cidr")');
    expect(warnings.some((w) => w.includes("cidr"))).toBe(true);
  });

  it("emits a warning when a table has no primary key", () => {
    const t = mkTable({ columns: [col("c1", "name", "text")] });
    const { warnings } = buildPrismaSchema([t], []);
    expect(warnings.some((w) => w.toLowerCase().includes("primary key") && w.includes("users"))).toBe(true);
  });

  it("emits a warning when two tables produce the same model name", () => {
    const a = mkTable({ id: "t1", name: "user_info", columns: [col("c1", "id", "integer", { isPrimaryKey: true })] });
    const b = mkTable({ id: "t2", name: "user-info", columns: [col("c2", "id", "integer", { isPrimaryKey: true })] });
    const { warnings } = buildPrismaSchema([a, b], []);
    expect(warnings.some((w) => w.toLowerCase().includes("conflict") || w.toLowerCase().includes("duplicate"))).toBe(true);
  });

  it("includes @db native type annotation when present", () => {
    const t = mkTable({ columns: [col("c1", "id", "uuid", { isPrimaryKey: true, isNullable: false })] });
    const { schema } = buildPrismaSchema([t], []);
    expect(schema).toContain("@db.Uuid");
  });
});
