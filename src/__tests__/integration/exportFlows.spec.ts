/**
 * Integration: all export paths end-to-end
 * Covers: buildTableSql, buildSchemaSql, buildMermaidEr, buildDrizzleSchema, buildPrismaSchema
 * Note: ExportModal UI tab switching and download/copy triggers are covered via component tests.
 */
import { describe, it, expect } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSchemaStore } from "../../stores/schemaStore";
import { buildTableSql, buildSchemaSql } from "../../utils/sqlExporter";
import { buildMermaidEr } from "../../utils/exporters/mermaid";
import { buildDrizzleSchema } from "../../utils/exporters/drizzle";
import { buildPrismaSchema } from "../../utils/exporters/prisma";

function makeStore() {
  setActivePinia(createPinia());
  return useSchemaStore();
}

function allOpts(store: ReturnType<typeof useSchemaStore>) {
  return {
    exportSet: new Set(store.tables.map((t) => t.id)),
    markCrossBoundary: false,
  };
}

/** Build a simple users + posts schema with a FK */
function buildBlogSchema(store: ReturnType<typeof useSchemaStore>) {
  store.addTable("users");
  store.addTable("posts");
  const users = store.tables[0];
  const posts = store.tables[1];
  store.addColumn(users.id);
  store.addColumn(posts.id);
  store.addColumn(posts.id);
  const userId = users.columns[0];
  const postId = posts.columns[0];
  const postUserId = posts.columns[1];
  store.updateColumn(users.id, userId.id, {
    name: "id",
    type: "UUID",
    isPrimaryKey: true,
    isNullable: false,
  });
  store.updateColumn(posts.id, postId.id, {
    name: "id",
    type: "UUID",
    isPrimaryKey: true,
    isNullable: false,
  });
  store.updateColumn(posts.id, postUserId.id, {
    name: "user_id",
    type: "UUID",
    isNullable: true,
  });
  store.addForeignKey({
    sourceTableId: posts.id,
    sourceColumnId: postUserId.id,
    targetTableId: users.id,
    targetColumnId: userId.id,
    onDelete: "CASCADE",
    onUpdate: "NO ACTION",
  });
  return { users, posts, userId, postId, postUserId };
}

// ─── SQL export ───────────────────────────────────────────────────────────────

describe("SQL export — single table", () => {
  it("generates CREATE TABLE for a single table", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const posts = store.tables.find((t) => t.name === "posts")!;
    const sql = buildTableSql(
      posts,
      store.tables,
      store.foreignKeys,
      allOpts(store),
    );
    expect(sql).toContain("CREATE TABLE posts");
  });

  it("NOT NULL column appears in CREATE TABLE", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const users = store.tables.find((t) => t.name === "users")!;
    const sql = buildTableSql(
      users,
      store.tables,
      store.foreignKeys,
      allOpts(store),
    );
    expect(sql).toContain("NOT NULL");
  });

  it("FK appears as ALTER TABLE ADD CONSTRAINT", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const posts = store.tables.find((t) => t.name === "posts")!;
    const sql = buildTableSql(
      posts,
      store.tables,
      store.foreignKeys,
      allOpts(store),
    );
    expect(sql).toContain("ALTER TABLE posts");
    expect(sql).toContain("FOREIGN KEY");
    expect(sql).toContain("REFERENCES users");
  });

  it("cross-boundary FK warning emitted when target not in exportSet", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const posts = store.tables.find((t) => t.name === "posts")!;
    const sql = buildTableSql(posts, store.tables, store.foreignKeys, {
      exportSet: new Set([posts.id]),
      markCrossBoundary: true,
    });
    expect(sql).toContain("WARNING: cross-boundary foreign key");
  });

  it("table notes appear as SQL line comments", () => {
    const store = makeStore();
    store.addTable("things");
    const t = store.tables[0];
    store.updateTable(t.id, { notes: "This table stores things" });
    const sql = buildTableSql(
      t,
      store.tables,
      store.foreignKeys,
      allOpts(store),
    );
    expect(sql).toContain("-- This table stores things");
  });
});

describe("SQL export — multi-table bundle", () => {
  it("generates SQL for all tables when all are in exportSet", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const sql = buildSchemaSql(store.tables, store.foreignKeys, allOpts(store));
    expect(sql).toContain("CREATE TABLE users");
    expect(sql).toContain("CREATE TABLE posts");
  });

  it("omits a table not in exportSet", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const posts = store.tables.find((t) => t.name === "posts")!;
    const sql = buildSchemaSql(store.tables, store.foreignKeys, {
      exportSet: new Set([posts.id]),
      markCrossBoundary: false,
    });
    expect(sql).not.toContain("CREATE TABLE users");
    expect(sql).toContain("CREATE TABLE posts");
  });

  it("index with no parts is skipped in bundle SQL", () => {
    const store = makeStore();
    store.addTable("items");
    const t = store.tables[0];
    store.addIndex(t.id, {
      name: "idx_empty",
      type: "normal",
      parts: [],
      filter: "",
    });
    const sql = buildSchemaSql(store.tables, store.foreignKeys, allOpts(store));
    expect(sql).not.toContain("CREATE INDEX idx_empty");
  });
});

// ─── Mermaid export ───────────────────────────────────────────────────────────

describe("Mermaid export", () => {
  it("generates erDiagram header", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { diagram } = buildMermaidEr(store.tables, store.foreignKeys);
    expect(diagram).toMatch(/^erDiagram/);
  });

  it("each table appears as an entity block", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { diagram } = buildMermaidEr(store.tables, store.foreignKeys);
    expect(diagram).toContain("users {");
    expect(diagram).toContain("posts {");
  });

  it("FK appears with cardinality annotation connecting the two tables", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { diagram } = buildMermaidEr(store.tables, store.foreignKeys);
    expect(diagram).toMatch(/users.*posts|posts.*users/);
  });

  it("nullable FK source uses 'o' cardinality marker on source side", () => {
    const store = makeStore();
    buildBlogSchema(store);
    // postUserId.isNullable = true → source card should be "o{"
    const { diagram } = buildMermaidEr(store.tables, store.foreignKeys);
    expect(diagram).toContain("o{");
  });

  it("unique/PK FK target uses '||' cardinality marker on target side", () => {
    const store = makeStore();
    buildBlogSchema(store);
    // userId.isPrimaryKey = true → target card should be "||"
    const { diagram } = buildMermaidEr(store.tables, store.foreignKeys);
    expect(diagram).toContain("||");
  });

  it("check constraints emit warning and header comment", () => {
    const store = makeStore();
    store.addTable("accounts");
    const t = store.tables[0];
    const table = store.tables.find((tbl) => tbl.id === t.id)!;
    table.checkConstraints.push({
      id: "c1",
      name: "chk_accounts_1",
      expression: "balance >= 0",
    });
    const { diagram, warnings } = buildMermaidEr(
      store.tables,
      store.foreignKeys,
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(diagram).toContain("%% CHECK");
  });

  it("expression index emits warning", () => {
    const store = makeStore();
    store.addTable("docs");
    const t = store.tables[0];
    store.addIndex(t.id, {
      name: "idx_docs_expr",
      type: "normal",
      parts: [{ type: "expression", value: "lower(title)", order: "ASC" }],
      filter: "",
    });
    const { warnings } = buildMermaidEr(store.tables, store.foreignKeys);
    expect(warnings.some((w) => w.toLowerCase().includes("expression"))).toBe(
      true,
    );
  });
});

// ─── Drizzle export ───────────────────────────────────────────────────────────

describe("Drizzle export", () => {
  it("generates pgTable import line", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { schema } = buildDrizzleSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("pgTable");
  });

  it("each table appears as export const", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { schema } = buildDrizzleSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("export const users");
    expect(schema).toContain("export const posts");
  });

  it("UUID column maps to uuid() Drizzle helper", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { schema } = buildDrizzleSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("uuid(");
  });

  it("FK appears as .references() chain", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { schema } = buildDrizzleSchema(store.tables, store.foreignKeys);
    expect(schema).toContain(".references(");
  });

  it("onDelete CASCADE maps to drizzle onDelete option", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { schema } = buildDrizzleSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("cascade");
  });

  it("circular FK emits warning", () => {
    const store = makeStore();
    store.addTable("a");
    store.addTable("b");
    const a = store.tables[0];
    const b = store.tables[1];
    store.addColumn(a.id);
    store.addColumn(b.id);
    const aCol = a.columns[0];
    const bCol = b.columns[0];
    store.addForeignKey({
      sourceTableId: a.id,
      sourceColumnId: aCol.id,
      targetTableId: b.id,
      targetColumnId: bCol.id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    store.addForeignKey({
      sourceTableId: b.id,
      sourceColumnId: bCol.id,
      targetTableId: a.id,
      targetColumnId: aCol.id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    const { warnings } = buildDrizzleSchema(store.tables, store.foreignKeys);
    expect(warnings.some((w) => w.toLowerCase().includes("circular"))).toBe(
      true,
    );
  });
});

// ─── Prisma export ────────────────────────────────────────────────────────────

describe("Prisma export", () => {
  it("generates datasource and generator blocks", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { schema } = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("datasource db");
    expect(schema).toContain("generator client");
  });

  it("each table appears as a model block", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { schema } = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("model Users");
    expect(schema).toContain("model Posts");
  });

  it("@id appears on primary key field", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { schema } = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("@id");
  });

  it("@relation with fields/references on FK source side", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { schema } = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("fields:");
    expect(schema).toContain("references:");
  });

  it("back-relation array field appears on FK target side", () => {
    const store = makeStore();
    buildBlogSchema(store);
    const { schema } = buildPrismaSchema(store.tables, store.foreignKeys);
    // Back-relation on users → Posts[]
    expect(schema).toMatch(/Posts\[\]/);
  });

  it("named @relation for self-referential FK", () => {
    const store = makeStore();
    store.addTable("categories");
    const t = store.tables[0];
    store.addColumn(t.id);
    store.addColumn(t.id);
    const idCol = t.columns[0];
    const parentCol = t.columns[1];
    store.updateColumn(t.id, idCol.id, { name: "id", isPrimaryKey: true });
    store.updateColumn(t.id, parentCol.id, {
      name: "parent_id",
      isNullable: true,
    });
    store.addForeignKey({
      sourceTableId: t.id,
      sourceColumnId: parentCol.id,
      targetTableId: t.id,
      targetColumnId: idCol.id,
      onDelete: "SET NULL",
      onUpdate: "NO ACTION",
    });
    const { schema } = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(schema).toContain('@relation("');
  });

  it("serial column uses @default(autoincrement())", () => {
    const store = makeStore();
    store.addTable("counters");
    const t = store.tables[0];
    store.addColumn(t.id);
    const col = t.columns[0];
    store.updateColumn(t.id, col.id, {
      name: "id",
      type: "SERIAL",
      isPrimaryKey: true,
    });
    const { schema } = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("@default(autoincrement())");
  });

  it("uuid default maps to @default(uuid())", () => {
    const store = makeStore();
    store.addTable("things");
    const t = store.tables[0];
    store.addColumn(t.id);
    const col = t.columns[0];
    store.updateColumn(t.id, col.id, {
      name: "id",
      type: "UUID",
      defaultValue: "gen_random_uuid()",
      isPrimaryKey: true,
    });
    const { schema } = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("@default(uuid())");
  });

  it("now() default maps to @default(now())", () => {
    const store = makeStore();
    store.addTable("events");
    const t = store.tables[0];
    store.addColumn(t.id);
    const col = t.columns[0];
    store.updateColumn(t.id, col.id, {
      name: "created_at",
      type: "TIMESTAMP",
      defaultValue: "now()",
    });
    const { schema } = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(schema).toContain("@default(now())");
  });

  it("CHECK constraint shows warning (not supported in Prisma)", () => {
    const store = makeStore();
    store.addTable("accounts");
    const t = store.tables[0];
    const table = store.tables.find((tbl) => tbl.id === t.id)!;
    table.checkConstraints.push({
      id: "c1",
      name: "chk_1",
      expression: "balance >= 0",
    });
    const { warnings } = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(warnings.some((w) => w.toLowerCase().includes("check"))).toBe(true);
  });

  it("table with no PK shows warning", () => {
    const store = makeStore();
    store.addTable("nopk");
    const t = store.tables[0];
    store.addColumn(t.id);
    // No column set as PK
    const { warnings } = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(warnings.some((w) => w.toLowerCase().includes("primary"))).toBe(
      true,
    );
  });
});
