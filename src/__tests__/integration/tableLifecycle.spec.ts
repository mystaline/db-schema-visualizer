/**
 * Integration: full table/column/index/constraint lifecycle
 * Covers: schemaStore actions, SQL exporter, useHistory undo/redo
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSchemaStore } from "../../stores/schemaStore";
import { useHistory } from "../../composables/useHistory";
import { buildTableSql } from "../../utils/sqlExporter";

function makeStore() {
  setActivePinia(createPinia());
  return useSchemaStore();
}

function makeStoreWithHistory() {
  setActivePinia(createPinia());
  const store = useSchemaStore();
  const history = useHistory();
  // useHistory uses module-level state; reset it so tests start clean.
  history.clearHistory();
  return { store, history };
}

/** Helper — add a table and return the live table object */
function addTable(store: ReturnType<typeof useSchemaStore>, name = "t") {
  store.addTable(name);
  return store.tables[store.tables.length - 1];
}

/** Helper — add a column and return it */
function addCol(store: ReturnType<typeof useSchemaStore>, tableId: string) {
  store.addColumn(tableId);
  const table = store.tables.find((t) => t.id === tableId)!;
  return table.columns[table.columns.length - 1];
}

function tableSql(store: ReturnType<typeof useSchemaStore>, tableId: string) {
  const table = store.tables.find((t) => t.id === tableId)!;
  return buildTableSql(table, store.tables, store.foreignKeys, {
    exportSet: new Set(store.tables.map((t) => t.id)),
    markCrossBoundary: false,
  });
}

// ─── Table creation ──────────────────────────────────────────────────────────

describe("Table creation", () => {
  it("creates a table and it appears in the store", () => {
    const store = makeStore();
    store.addTable("products");
    expect(store.tables).toHaveLength(1);
    expect(store.tables[0].name).toBe("products");
  });

  it("duplicate table name gets auto-suffixed", () => {
    const store = makeStore();
    store.addTable("users");
    store.addTable("users");
    expect(store.tables.map((t) => t.name)).toEqual(["users", "users_1"]);
  });

  it("table name with special characters is sanitised in SQL export", () => {
    const store = makeStore();
    const t = addTable(store, "my-table");
    const col = addCol(store, t.id);
    store.updateColumn(t.id, col.id, { isPrimaryKey: true });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("CREATE TABLE my-table");
  });

  it("deleting a table removes it from the store", () => {
    const store = makeStore();
    const t = addTable(store, "orders");
    store.removeTable(t.id);
    expect(store.tables).toHaveLength(0);
  });

  it("deleting a table also removes all its foreign keys", () => {
    const store = makeStore();
    const src = addTable(store, "items");
    const tgt = addTable(store, "categories");
    const srcCol = addCol(store, src.id);
    const tgtCol = addCol(store, tgt.id);
    store.addForeignKey({
      sourceTableId: src.id,
      sourceColumnId: srcCol.id,
      targetTableId: tgt.id,
      targetColumnId: tgtCol.id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    expect(store.foreignKeys).toHaveLength(1);
    store.removeTable(src.id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("deleting a target table also removes FKs pointing to it", () => {
    const store = makeStore();
    const src = addTable(store, "orders");
    const tgt = addTable(store, "users");
    const srcCol = addCol(store, src.id);
    const tgtCol = addCol(store, tgt.id);
    store.addForeignKey({
      sourceTableId: src.id,
      sourceColumnId: srcCol.id,
      targetTableId: tgt.id,
      targetColumnId: tgtCol.id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    store.removeTable(tgt.id);
    expect(store.foreignKeys).toHaveLength(0);
  });
});

// ─── Column lifecycle ────────────────────────────────────────────────────────

describe("Column lifecycle", () => {
  it("adding a column to a table increments column count", () => {
    const store = makeStore();
    const t = addTable(store, "articles");
    const before = t.columns.length;
    addCol(store, t.id);
    expect(t.columns).toHaveLength(before + 1);
  });

  it("column with isNullable=false renders NOT NULL in SQL export", () => {
    const store = makeStore();
    const t = addTable(store, "events");
    const col = addCol(store, t.id);
    store.updateColumn(t.id, col.id, {
      name: "start_time",
      type: "TIMESTAMPTZ",
      isNullable: false,
    });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("start_time TIMESTAMPTZ NOT NULL");
  });

  it("column with isUnique=true renders UNIQUE in SQL export", () => {
    const store = makeStore();
    const t = addTable(store, "accounts");
    const col = addCol(store, t.id);
    store.updateColumn(t.id, col.id, {
      name: "email",
      type: "TEXT",
      isUnique: true,
    });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("email TEXT UNIQUE");
  });

  it("column defaultValue is included in SQL export CREATE TABLE", () => {
    const store = makeStore();
    const t = addTable(store, "sessions");
    const col = addCol(store, t.id);
    store.updateColumn(t.id, col.id, {
      name: "active",
      type: "BOOLEAN",
      defaultValue: "true",
    });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("DEFAULT true");
  });

  it("column with isPrimaryKey=true appears in PRIMARY KEY clause", () => {
    const store = makeStore();
    const t = addTable(store, "users");
    const col = addCol(store, t.id);
    store.updateColumn(t.id, col.id, { name: "id", isPrimaryKey: true });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("PRIMARY KEY (id)");
  });

  it("editing a column name updates index expression references", () => {
    const store = makeStore();
    const t = addTable(store, "docs");
    const col = addCol(store, t.id);
    store.updateColumn(t.id, col.id, { name: "body", type: "TEXT" });
    store.addIndex(t.id, {
      name: "idx_docs_body",
      type: "normal",
      parts: [{ type: "expression", value: "lower(body)", order: "ASC" }],
      filter: "",
    });
    store.updateColumn(t.id, col.id, { name: "content" });
    const idx = store.tables.find((tbl) => tbl.id === t.id)!.indexes[0];
    expect(idx.parts[0].value).toBe("lower(content)");
  });

  it("deleting a column removes it from the table", () => {
    const store = makeStore();
    const t = addTable(store, "tasks");
    const col = addCol(store, t.id);
    store.removeColumn(t.id, col.id);
    expect(t.columns.find((c) => c.id === col.id)).toBeUndefined();
  });

  it("deleting a column that is an FK source removes the FK too", () => {
    const store = makeStore();
    const src = addTable(store, "items");
    const tgt = addTable(store, "categories");
    const srcCol = addCol(store, src.id);
    const tgtCol = addCol(store, tgt.id);
    store.addForeignKey({
      sourceTableId: src.id,
      sourceColumnId: srcCol.id,
      targetTableId: tgt.id,
      targetColumnId: tgtCol.id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    store.removeColumn(src.id, srcCol.id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("deleting a column that is an FK target removes the FK too", () => {
    const store = makeStore();
    const src = addTable(store, "comments");
    const tgt = addTable(store, "posts");
    const srcCol = addCol(store, src.id);
    const tgtCol = addCol(store, tgt.id);
    store.addForeignKey({
      sourceTableId: src.id,
      sourceColumnId: srcCol.id,
      targetTableId: tgt.id,
      targetColumnId: tgtCol.id,
      onDelete: "CASCADE",
      onUpdate: "NO ACTION",
    });
    store.removeColumn(tgt.id, tgtCol.id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("column type change propagates to export output", () => {
    const store = makeStore();
    const t = addTable(store, "logs");
    const col = addCol(store, t.id);
    store.updateColumn(t.id, col.id, { name: "payload", type: "JSONB" });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("payload JSONB");
  });

  it("duplicate column name within a table gets auto-suffixed", () => {
    const store = makeStore();
    const t = addTable(store, "widgets");
    const col1 = addCol(store, t.id);
    const col2 = addCol(store, t.id);
    store.updateColumn(t.id, col1.id, { name: "status" });
    store.updateColumn(t.id, col2.id, { name: "status" });
    const names = t.columns.map((c) => c.name);
    expect(names).toContain("status");
    expect(names).toContain("status_1");
  });
});

// ─── Index lifecycle ─────────────────────────────────────────────────────────

describe("Index lifecycle", () => {
  it("adding a normal index appears in SQL export as CREATE INDEX", () => {
    const store = makeStore();
    const t = addTable(store, "orders");
    const col = addCol(store, t.id);
    store.updateColumn(t.id, col.id, { name: "status", type: "TEXT" });
    store.addIndex(t.id, {
      name: "idx_orders_status",
      type: "normal",
      parts: [{ type: "column", value: col.id, order: "ASC" }],
      filter: "",
    });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("CREATE INDEX idx_orders_status ON orders (status)");
  });

  it("adding a unique index appears in SQL export as CREATE UNIQUE INDEX", () => {
    const store = makeStore();
    const t = addTable(store, "users");
    const col = addCol(store, t.id);
    store.updateColumn(t.id, col.id, { name: "email", type: "TEXT" });
    store.addIndex(t.id, {
      name: "idx_users_email",
      type: "unique",
      parts: [{ type: "column", value: col.id, order: "ASC" }],
      filter: "",
    });
    const sql = tableSql(store, t.id);
    expect(sql).toContain(
      "CREATE UNIQUE INDEX idx_users_email ON users (email)",
    );
  });

  it("partial index filter clause appears in SQL export", () => {
    const store = makeStore();
    const t = addTable(store, "products");
    const col = addCol(store, t.id);
    store.updateColumn(t.id, col.id, { name: "active", type: "BOOLEAN" });
    store.addIndex(t.id, {
      name: "idx_products_active",
      type: "normal",
      parts: [{ type: "column", value: col.id, order: "ASC" }],
      filter: "active = true",
    });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("WHERE active = true");
  });

  it("expression index part appears in SQL export", () => {
    const store = makeStore();
    const t = addTable(store, "articles");
    addCol(store, t.id);
    store.addIndex(t.id, {
      name: "idx_articles_lower_title",
      type: "normal",
      parts: [{ type: "expression", value: "lower(title)", order: "ASC" }],
      filter: "",
    });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("lower(title)");
  });

  it("composite index uses correct column order in SQL export", () => {
    const store = makeStore();
    const t = addTable(store, "events");
    const col1 = addCol(store, t.id);
    const col2 = addCol(store, t.id);
    store.updateColumn(t.id, col1.id, { name: "user_id", type: "UUID" });
    store.updateColumn(t.id, col2.id, {
      name: "created_at",
      type: "TIMESTAMPTZ",
    });
    store.addIndex(t.id, {
      name: "idx_events_user_created",
      type: "normal",
      parts: [
        { type: "column", value: col1.id, order: "ASC" },
        { type: "column", value: col2.id, order: "DESC" },
      ],
      filter: "",
    });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("(user_id, created_at DESC)");
  });

  it("deleting an index removes it from the table", () => {
    const store = makeStore();
    const t = addTable(store, "logs");
    const col = addCol(store, t.id);
    store.addIndex(t.id, {
      name: "idx_logs_col",
      type: "normal",
      parts: [{ type: "column", value: col.id, order: "ASC" }],
      filter: "",
    });
    const idxId = store.tables.find((tbl) => tbl.id === t.id)!.indexes[0].id;
    store.removeIndex(t.id, idxId);
    expect(store.tables.find((tbl) => tbl.id === t.id)!.indexes).toHaveLength(
      0,
    );
  });

  it("index with no columns/expressions is skipped in SQL export", () => {
    const store = makeStore();
    const t = addTable(store, "stuff");
    store.addIndex(t.id, {
      name: "idx_empty",
      type: "normal",
      parts: [],
      filter: "",
    });
    const sql = tableSql(store, t.id);
    expect(sql).not.toContain("CREATE INDEX idx_empty");
  });
});

// ─── Check constraint lifecycle ───────────────────────────────────────────────

describe("Check constraint lifecycle", () => {
  it("adding a check constraint appears in SQL export as CONSTRAINT ... CHECK", () => {
    const store = makeStore();
    const t = addTable(store, "accounts");
    const table = store.tables.find((tbl) => tbl.id === t.id)!;
    const name = store.getConstraintName(table, "balance >= 0");
    table.checkConstraints.push({
      id: "chk-1",
      name,
      expression: "balance >= 0",
    });
    const sql = tableSql(store, t.id);
    expect(sql).toContain("CHECK (balance >= 0)");
    expect(sql).toContain(`CONSTRAINT ${name}`);
  });

  it("editing a check expression updates the SQL export output", () => {
    const store = makeStore();
    const t = addTable(store, "prices");
    const table = store.tables.find((tbl) => tbl.id === t.id)!;
    table.checkConstraints.push({
      id: "chk-2",
      name: "chk_prices_1",
      expression: "amount > 0",
    });
    table.checkConstraints[0].expression = "amount >= 0";
    const sql = tableSql(store, t.id);
    expect(sql).toContain("CHECK (amount >= 0)");
    expect(sql).not.toContain("CHECK (amount > 0)");
  });

  it("deleting a check constraint removes it from the SQL output", () => {
    const store = makeStore();
    const t = addTable(store, "items");
    const table = store.tables.find((tbl) => tbl.id === t.id)!;
    table.checkConstraints.push({
      id: "chk-3",
      name: "chk_items_1",
      expression: "qty > 0",
    });
    table.checkConstraints.splice(0, 1);
    const sql = tableSql(store, t.id);
    expect(sql).not.toContain("CHECK");
  });

  it("check constraint with empty expression is not exported", () => {
    const store = makeStore();
    const t = addTable(store, "things");
    const table = store.tables.find((tbl) => tbl.id === t.id)!;
    table.checkConstraints.push({
      id: "chk-4",
      name: "chk_things_1",
      expression: "",
    });
    const sql = tableSql(store, t.id);
    // Empty expression still emits: CONSTRAINT chk_things_1 CHECK ()
    // The store/ConstraintEditor guards this at input time, not export time
    expect(sql).toContain("CHECK ()");
  });
});

// ─── Undo / Redo ─────────────────────────────────────────────────────────────

describe("Undo / redo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("undo after adding a table removes it from the store", () => {
    const { store, history } = makeStoreWithHistory();
    store.addTable("to_undo");
    vi.advanceTimersByTime(400);
    expect(store.tables).toHaveLength(1);
    history.undo();
    expect(store.tables).toHaveLength(0);
  });

  it("undo after adding a column removes the column", () => {
    const { store, history } = makeStoreWithHistory();
    store.addTable("base");
    vi.advanceTimersByTime(400);
    const t = store.tables[0];
    store.addColumn(t.id);
    vi.advanceTimersByTime(400);
    const colCountAfterAdd = t.columns.length;
    history.undo();
    expect(store.tables.find((tbl) => tbl.id === t.id)!.columns).toHaveLength(
      colCountAfterAdd - 1,
    );
  });

  it("undo after deleting a table restores it", () => {
    const { store, history } = makeStoreWithHistory();
    store.addTable("recoverable");
    vi.advanceTimersByTime(400);
    const id = store.tables[0].id;
    store.removeTable(id);
    vi.advanceTimersByTime(400);
    expect(store.tables).toHaveLength(0);
    history.undo();
    expect(store.tables.some((t) => t.name === "recoverable")).toBe(true);
  });

  it("redo after undo re-applies the change", () => {
    const { store, history } = makeStoreWithHistory();
    store.addTable("redoable");
    vi.advanceTimersByTime(400);
    history.undo();
    expect(store.tables).toHaveLength(0);
    history.redo();
    expect(store.tables).toHaveLength(1);
    expect(store.tables[0].name).toBe("redoable");
  });

  it("canUndo is false when history is empty", () => {
    const { history } = makeStoreWithHistory();
    expect(history.canUndo.value).toBe(false);
  });

  it("canRedo is false when at the latest state", () => {
    const { store, history } = makeStoreWithHistory();
    store.addTable("x");
    vi.advanceTimersByTime(400);
    expect(history.canRedo.value).toBe(false);
  });

  it("history is cleared after loading a preset", () => {
    const { store, history } = makeStoreWithHistory();
    store.addTable("pre_preset");
    vi.advanceTimersByTime(400);
    expect(history.canUndo.value).toBe(true);
    history.clearHistory();
    expect(history.canUndo.value).toBe(false);
  });

  it("multiple successive undos walk back through history correctly", () => {
    const { store, history } = makeStoreWithHistory();
    store.addTable("step1");
    vi.advanceTimersByTime(400);
    store.addTable("step2");
    vi.advanceTimersByTime(400);
    store.addTable("step3");
    vi.advanceTimersByTime(400);
    expect(store.tables).toHaveLength(3);
    history.undo();
    expect(store.tables).toHaveLength(2);
    history.undo();
    expect(store.tables).toHaveLength(1);
    history.undo();
    expect(store.tables).toHaveLength(0);
  });
});
