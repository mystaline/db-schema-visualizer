/**
 * Integration: full foreign key lifecycle
 * Covers: schemaStore FK actions, SQL / Drizzle / Prisma / Mermaid exporters
 */
import { describe, it, expect } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSchemaStore } from "../../stores/schemaStore";
import { buildTableSql } from "../../utils/sqlExporter";
import { buildDrizzleSchema } from "../../utils/exporters/drizzle";
import { buildPrismaSchema } from "../../utils/exporters/prisma";
import { buildMermaidEr } from "../../utils/exporters/mermaid";

function makeStore() {
  setActivePinia(createPinia());
  return useSchemaStore();
}

/** Build a simple two-table setup with one FK */
function setupTwoTableFk(store: ReturnType<typeof useSchemaStore>) {
  store.addTable("users");
  store.addTable("posts");
  const users = store.tables[0];
  const posts = store.tables[1];
  store.addColumn(users.id);
  store.addColumn(posts.id);
  const userId = users.columns[users.columns.length - 1];
  const postUserId = posts.columns[posts.columns.length - 1];
  store.updateColumn(users.id, userId.id, {
    name: "id",
    type: "UUID",
    isPrimaryKey: true,
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
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  });
  return { users, posts, userId, postUserId, fk: store.foreignKeys[0] };
}

// ─── FK creation ─────────────────────────────────────────────────────────────

describe("FK creation", () => {
  it("adding a FK appears in the store foreignKeys array", () => {
    const store = makeStore();
    const { fk } = setupTwoTableFk(store);
    expect(store.foreignKeys).toHaveLength(1);
    expect(fk).toBeDefined();
    expect(fk.id).toBeTruthy();
  });

  it("FK source column and target column IDs resolve to correct columns", () => {
    const store = makeStore();
    const { users, posts, userId, postUserId, fk } = setupTwoTableFk(store);
    expect(fk.sourceTableId).toBe(posts.id);
    expect(fk.sourceColumnId).toBe(postUserId.id);
    expect(fk.targetTableId).toBe(users.id);
    expect(fk.targetColumnId).toBe(userId.id);
  });

  it("self-referential FK (same table source and target) is supported", () => {
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
    expect(store.foreignKeys).toHaveLength(1);
    expect(store.foreignKeys[0].sourceTableId).toBe(t.id);
    expect(store.foreignKeys[0].targetTableId).toBe(t.id);
  });

  it("multiple FKs from same table are all stored independently", () => {
    const store = makeStore();
    store.addTable("orders");
    store.addTable("users");
    store.addTable("products");
    const orders = store.tables[0];
    const users = store.tables[1];
    const products = store.tables[2];
    store.addColumn(orders.id);
    store.addColumn(orders.id);
    store.addColumn(users.id);
    store.addColumn(products.id);
    const orderUserId = orders.columns[0];
    const orderProductId = orders.columns[1];
    const userId = users.columns[0];
    const productId = products.columns[0];
    store.updateColumn(users.id, userId.id, { name: "id", isPrimaryKey: true });
    store.updateColumn(products.id, productId.id, {
      name: "id",
      isPrimaryKey: true,
    });
    store.addForeignKey({
      sourceTableId: orders.id,
      sourceColumnId: orderUserId.id,
      targetTableId: users.id,
      targetColumnId: userId.id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    store.addForeignKey({
      sourceTableId: orders.id,
      sourceColumnId: orderProductId.id,
      targetTableId: products.id,
      targetColumnId: productId.id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    expect(store.foreignKeys).toHaveLength(2);
    expect(store.foreignKeys[0].id).not.toBe(store.foreignKeys[1].id);
  });

  it("FK with onDelete=CASCADE appears in SQL export", () => {
    const store = makeStore();
    setupTwoTableFk(store);
    store.updateForeignKey(store.foreignKeys[0].id, { onDelete: "CASCADE" });
    const posts = store.tables.find((t) => t.name === "posts")!;
    const sql = buildTableSql(posts, store.tables, store.foreignKeys, {
      exportSet: new Set(store.tables.map((t) => t.id)),
      markCrossBoundary: false,
    });
    expect(sql).toContain("ON DELETE CASCADE");
  });

  it("FK with onDelete=SET NULL appears in SQL export", () => {
    const store = makeStore();
    setupTwoTableFk(store);
    store.updateForeignKey(store.foreignKeys[0].id, { onDelete: "SET NULL" });
    const posts = store.tables.find((t) => t.name === "posts")!;
    const sql = buildTableSql(posts, store.tables, store.foreignKeys, {
      exportSet: new Set(store.tables.map((t) => t.id)),
      markCrossBoundary: false,
    });
    expect(sql).toContain("ON DELETE SET NULL");
  });

  it("FK with onDelete=RESTRICT appears in SQL export", () => {
    const store = makeStore();
    setupTwoTableFk(store);
    store.updateForeignKey(store.foreignKeys[0].id, { onDelete: "RESTRICT" });
    const posts = store.tables.find((t) => t.name === "posts")!;
    const sql = buildTableSql(posts, store.tables, store.foreignKeys, {
      exportSet: new Set(store.tables.map((t) => t.id)),
      markCrossBoundary: false,
    });
    expect(sql).toContain("ON DELETE RESTRICT");
  });

  it("FK with onUpdate=CASCADE appears in SQL export", () => {
    const store = makeStore();
    setupTwoTableFk(store);
    store.updateForeignKey(store.foreignKeys[0].id, { onUpdate: "CASCADE" });
    const posts = store.tables.find((t) => t.name === "posts")!;
    const sql = buildTableSql(posts, store.tables, store.foreignKeys, {
      exportSet: new Set(store.tables.map((t) => t.id)),
      markCrossBoundary: false,
    });
    expect(sql).toContain("ON UPDATE CASCADE");
  });
});

// ─── FK editing ───────────────────────────────────────────────────────────────

describe("FK editing", () => {
  it("changing source column updates FK in store", () => {
    const store = makeStore();
    const { fk } = setupTwoTableFk(store);
    const posts = store.tables.find((t) => t.name === "posts")!;
    store.addColumn(posts.id);
    const newCol = posts.columns[posts.columns.length - 1];
    store.updateForeignKey(fk.id, { sourceColumnId: newCol.id });
    expect(store.foreignKeys[0].sourceColumnId).toBe(newCol.id);
  });

  it("changing target table updates FK in store", () => {
    const store = makeStore();
    const { fk } = setupTwoTableFk(store);
    store.addTable("authors");
    const authors = store.tables.find((t) => t.name === "authors")!;
    store.addColumn(authors.id);
    const authorId = authors.columns[0];
    store.updateForeignKey(fk.id, {
      targetTableId: authors.id,
      targetColumnId: authorId.id,
    });
    expect(store.foreignKeys[0].targetTableId).toBe(authors.id);
  });

  it("changing onDelete action updates FK in store", () => {
    const store = makeStore();
    const { fk } = setupTwoTableFk(store);
    store.updateForeignKey(fk.id, { onDelete: "CASCADE" });
    expect(store.foreignKeys[0].onDelete).toBe("CASCADE");
  });

  it("changing onUpdate action updates FK in store", () => {
    const store = makeStore();
    const { fk } = setupTwoTableFk(store);
    store.updateForeignKey(fk.id, { onUpdate: "SET NULL" });
    expect(store.foreignKeys[0].onUpdate).toBe("SET NULL");
  });
});

// ─── FK deletion ──────────────────────────────────────────────────────────────

describe("FK deletion", () => {
  it("deleting a FK removes it from the store", () => {
    const store = makeStore();
    const { fk } = setupTwoTableFk(store);
    store.removeForeignKey(fk.id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("deleting the source table cascades to remove the FK", () => {
    const store = makeStore();
    const { posts } = setupTwoTableFk(store);
    store.removeTable(posts.id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("deleting the target table cascades to remove the FK", () => {
    const store = makeStore();
    const { users } = setupTwoTableFk(store);
    store.removeTable(users.id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("deleting the source column cascades to remove the FK", () => {
    const store = makeStore();
    const { posts, postUserId } = setupTwoTableFk(store);
    store.removeColumn(posts.id, postUserId.id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("deleting the target column cascades to remove the FK", () => {
    const store = makeStore();
    const { users, userId } = setupTwoTableFk(store);
    store.removeColumn(users.id, userId.id);
    expect(store.foreignKeys).toHaveLength(0);
  });
});

// ─── FK in exports ────────────────────────────────────────────────────────────

describe("FK in exports", () => {
  it("FK appears as REFERENCES clause in SQL export", () => {
    const store = makeStore();
    const { posts } = setupTwoTableFk(store);
    const sql = buildTableSql(posts, store.tables, store.foreignKeys, {
      exportSet: new Set(store.tables.map((t) => t.id)),
      markCrossBoundary: false,
    });
    expect(sql).toContain("REFERENCES users");
  });

  it("FK between tables in different export bundles shows cross-bundle warning", () => {
    const store = makeStore();
    const { posts } = setupTwoTableFk(store);
    // Export only posts, not users
    const sql = buildTableSql(posts, store.tables, store.foreignKeys, {
      exportSet: new Set([posts.id]),
      markCrossBoundary: true,
    });
    expect(sql).toContain("WARNING: cross-boundary foreign key");
  });

  it("circular FK (A→B→A) detected and warning shown in Drizzle export", () => {
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
    const result = buildDrizzleSchema(store.tables, store.foreignKeys);
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("circular")),
    ).toBe(true);
  });

  it("FK appears as .references() in Drizzle export", () => {
    const store = makeStore();
    setupTwoTableFk(store);
    const result = buildDrizzleSchema(store.tables, store.foreignKeys);
    expect(result.schema).toContain(".references(");
  });

  it("FK appears as @relation in Prisma export with correct fields/references", () => {
    const store = makeStore();
    setupTwoTableFk(store);
    const result = buildPrismaSchema(store.tables, store.foreignKeys);
    expect(result.schema).toContain("@relation(");
    expect(result.schema).toContain("fields:");
    expect(result.schema).toContain("references:");
  });

  it("self-referential FK generates named relation in Prisma export", () => {
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
    const result = buildPrismaSchema(store.tables, store.foreignKeys);
    // Self-referential FKs require a named @relation to disambiguate
    expect(result.schema).toContain('@relation("');
  });

  it("FK appears as cardinality annotation in Mermaid export", () => {
    const store = makeStore();
    setupTwoTableFk(store);
    const result = buildMermaidEr(store.tables, store.foreignKeys);
    // Should have a line connecting users and posts
    expect(result.diagram).toMatch(/users.*posts|posts.*users/);
    expect(result.warnings).toHaveLength(0);
  });
});
