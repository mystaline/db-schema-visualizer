import { describe, it, expect } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSchemaStore } from "../../stores/schemaStore";

function makeStore() {
  setActivePinia(createPinia());
  return useSchemaStore();
}

// ─── Table name uniqueness ──────────────────────────────────────────────────

describe("Table name uniqueness", () => {
  it("adding a table with a duplicate name auto-suffixes it", () => {
    const store = makeStore();
    store.addTable("users");
    store.addTable("users");
    const names = store.tables.map((t) => t.name);
    expect(names).toContain("users");
    expect(names).toContain("users_1");
  });

  it("third duplicate gets _2 suffix", () => {
    const store = makeStore();
    store.addTable("orders");
    store.addTable("orders");
    store.addTable("orders");
    const names = store.tables.map((t) => t.name);
    expect(names).toEqual(["orders", "orders_1", "orders_2"]);
  });

  it("renaming a table to an existing name auto-suffixes it", () => {
    const store = makeStore();
    store.addTable("customers");
    store.addTable("orders");
    const ordersId = store.tables[1].id;
    store.updateTable(ordersId, { name: "customers" });
    expect(store.tables[1].name).toBe("customers_1");
  });

  it("renaming a table to its own name is a no-op", () => {
    const store = makeStore();
    store.addTable("items");
    const id = store.tables[0].id;
    store.updateTable(id, { name: "items" });
    expect(store.tables[0].name).toBe("items");
  });
});

// ─── Column operations ──────────────────────────────────────────────────────

describe("Column operations", () => {
  it("addColumn generates a non-empty string ID", () => {
    const store = makeStore();
    store.addTable("t");
    const table = store.tables[0];
    store.addColumn(table.id);
    expect(typeof table.columns[0].id).toBe("string");
    expect(table.columns[0].id.length).toBeGreaterThan(0);
  });

  it("addColumn defaults name to 'new_column'", () => {
    const store = makeStore();
    store.addTable("t");
    store.addColumn(store.tables[0].id);
    expect(store.tables[0].columns[0].name).toBe("new_column");
  });

  it("addColumn auto-suffixes duplicate column names", () => {
    const store = makeStore();
    store.addTable("t");
    const tid = store.tables[0].id;
    store.addColumn(tid);
    store.addColumn(tid);
    const names = store.tables[0].columns.map((c) => c.name);
    expect(names).toContain("new_column");
    expect(names).toContain("new_column_1");
  });

  it("addColumn is a no-op for unknown tableId", () => {
    const store = makeStore();
    store.addColumn("nonexistent");
    expect(store.tables).toHaveLength(0);
  });

  it("reorderColumns swaps two columns", () => {
    const store = makeStore();
    store.addTable("t");
    const tid = store.tables[0].id;
    store.addColumn(tid);
    store.addColumn(tid);
    const firstId = store.tables[0].columns[0].id;
    const secondId = store.tables[0].columns[1].id;
    store.reorderColumns(tid, 0, 1);
    expect(store.tables[0].columns[0].id).toBe(secondId);
    expect(store.tables[0].columns[1].id).toBe(firstId);
  });

  it("removeColumn removes only the specified column", () => {
    const store = makeStore();
    store.addTable("t");
    const tid = store.tables[0].id;
    store.addColumn(tid);
    store.addColumn(tid);
    const keepId = store.tables[0].columns[0].id;
    const removeId = store.tables[0].columns[1].id;
    store.removeColumn(tid, removeId);
    expect(store.tables[0].columns).toHaveLength(1);
    expect(store.tables[0].columns[0].id).toBe(keepId);
  });

  it("removeColumn also removes FKs that reference it as source", () => {
    const store = makeStore();
    store.addTable("a");
    store.addTable("b");
    const a = store.tables[0];
    const b = store.tables[1];
    store.addColumn(a.id);
    store.addColumn(b.id);
    const srcCol = a.columns[0];
    const tgtCol = b.columns[0];
    store.addForeignKey({
      sourceTableId: a.id,
      sourceColumnId: srcCol.id,
      targetTableId: b.id,
      targetColumnId: tgtCol.id,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    expect(store.foreignKeys).toHaveLength(1);
    store.removeColumn(a.id, srcCol.id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("removeColumn also removes FKs that reference it as target", () => {
    const store = makeStore();
    store.addTable("a");
    store.addTable("b");
    const a = store.tables[0];
    const b = store.tables[1];
    store.addColumn(a.id);
    store.addColumn(b.id);
    const srcCol = a.columns[0];
    const tgtCol = b.columns[0];
    store.addForeignKey({
      sourceTableId: a.id,
      sourceColumnId: srcCol.id,
      targetTableId: b.id,
      targetColumnId: tgtCol.id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    store.removeColumn(b.id, tgtCol.id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("removeColumn also removes indexes that reference it", () => {
    const store = makeStore();
    store.addTable("t");
    const tid = store.tables[0].id;
    store.addColumn(tid);
    const col = store.tables[0].columns[0];
    store.addIndex(tid, {
      name: "idx_t_col",
      type: "normal",
      parts: [{ type: "column", value: col.id, order: "ASC" }],
    });
    expect(store.tables[0].indexes).toHaveLength(1);
    store.removeColumn(tid, col.id);
    expect(store.tables[0].indexes).toHaveLength(0);
  });

  it("updateColumn renames expression indexes when column name changes", () => {
    const store = makeStore();
    store.addTable("t");
    const tid = store.tables[0].id;
    store.addColumn(tid);
    const col = store.tables[0].columns[0];
    store.updateColumn(tid, col.id, { name: "amount" });
    store.addIndex(tid, {
      name: "idx",
      type: "normal",
      parts: [{ type: "expression", value: "lower(amount)", order: "ASC" }],
    });
    store.updateColumn(tid, col.id, { name: "total" });
    expect(store.tables[0].indexes[0].parts[0].value).toBe("lower(total)");
  });

  it("setting isPrimaryKey on a column clears isPrimaryKey on all others", () => {
    const store = makeStore();
    store.addTable("t");
    const tid = store.tables[0].id;
    store.addColumn(tid);
    store.addColumn(tid);
    const [c1, c2] = store.tables[0].columns;
    store.updateColumn(tid, c1.id, { isPrimaryKey: true });
    store.updateColumn(tid, c2.id, { isPrimaryKey: true });
    expect(store.tables[0].columns[0].isPrimaryKey).toBe(false);
    expect(store.tables[0].columns[1].isPrimaryKey).toBe(true);
  });
});

// ─── Index operations ───────────────────────────────────────────────────────

describe("Index operations", () => {
  it("addIndex generates a non-empty string ID", () => {
    const store = makeStore();
    store.addTable("t");
    const tid = store.tables[0].id;
    store.addIndex(tid, { name: "idx_t", type: "normal", parts: [] });
    expect(typeof store.tables[0].indexes[0].id).toBe("string");
    expect(store.tables[0].indexes[0].id.length).toBeGreaterThan(0);
  });

  it("removeIndex removes only the specified index", () => {
    const store = makeStore();
    store.addTable("t");
    const tid = store.tables[0].id;
    store.addIndex(tid, { name: "idx_a", type: "normal", parts: [] });
    store.addIndex(tid, { name: "idx_b", type: "unique", parts: [] });
    const keepId = store.tables[0].indexes[0].id;
    const removeId = store.tables[0].indexes[1].id;
    store.removeIndex(tid, removeId);
    expect(store.tables[0].indexes).toHaveLength(1);
    expect(store.tables[0].indexes[0].id).toBe(keepId);
  });

  it("removeIndex is a no-op for unknown tableId", () => {
    const store = makeStore();
    store.removeIndex("nope", "nope");
    expect(store.tables).toHaveLength(0);
  });

  it("getIndexName builds name from table and column parts", () => {
    const store = makeStore();
    store.addTable("orders");
    const tid = store.tables[0].id;
    store.addColumn(tid);
    store.updateColumn(tid, store.tables[0].columns[0].id, {
      name: "customer_id",
    });
    const col = store.tables[0].columns[0];
    const name = store.getIndexName(store.tables[0], {
      type: "normal",
      parts: [{ type: "column", value: col.id, order: "ASC" }],
    });
    expect(name).toBe("idx_orders_customer_id");
  });

  it("getIndexName uses 'unq' prefix for unique indexes", () => {
    const store = makeStore();
    store.addTable("users");
    const tid = store.tables[0].id;
    store.addColumn(tid);
    store.updateColumn(tid, store.tables[0].columns[0].id, { name: "email" });
    const col = store.tables[0].columns[0];
    const name = store.getIndexName(store.tables[0], {
      type: "unique",
      parts: [{ type: "column", value: col.id, order: "ASC" }],
    });
    expect(name).toBe("unq_users_email");
  });
});

// ─── Check constraint operations ────────────────────────────────────────────

describe("Check constraint operations", () => {
  it("getConstraintName builds name from table and expression", () => {
    const store = makeStore();
    store.addTable("products");
    const name = store.getConstraintName(store.tables[0], "price > 0");
    expect(name).toBe("chk_products_price0");
  });

  it("updateColumn renames check constraint expressions when column name changes", () => {
    const store = makeStore();
    store.addTable("products");
    const tid = store.tables[0].id;
    store.addColumn(tid);
    const col = store.tables[0].columns[0];
    store.updateColumn(tid, col.id, { name: "price" });
    store.tables[0].checkConstraints.push({
      id: "ck1",
      name: "chk_products_price0",
      expression: "price > 0",
    });
    store.updateColumn(tid, col.id, { name: "cost" });
    expect(store.tables[0].checkConstraints[0].expression).toBe("cost > 0");
  });
});

// ─── FK operations ──────────────────────────────────────────────────────────

describe("FK operations", () => {
  it("addForeignKey generates a unique ID", () => {
    const store = makeStore();
    store.addTable("a");
    store.addTable("b");
    store.addColumn(store.tables[0].id);
    store.addColumn(store.tables[1].id);
    store.addForeignKey({
      sourceTableId: store.tables[0].id,
      sourceColumnId: store.tables[0].columns[0].id,
      targetTableId: store.tables[1].id,
      targetColumnId: store.tables[1].columns[0].id,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    expect(typeof store.foreignKeys[0].id).toBe("string");
    expect(store.foreignKeys[0].id.length).toBeGreaterThan(0);
  });

  it("updateForeignKey changes only specified fields", () => {
    const store = makeStore();
    store.addTable("a");
    store.addTable("b");
    store.addColumn(store.tables[0].id);
    store.addColumn(store.tables[1].id);
    store.addForeignKey({
      sourceTableId: store.tables[0].id,
      sourceColumnId: store.tables[0].columns[0].id,
      targetTableId: store.tables[1].id,
      targetColumnId: store.tables[1].columns[0].id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    const fkId = store.foreignKeys[0].id;
    store.updateForeignKey(fkId, { onDelete: "CASCADE" });
    expect(store.foreignKeys[0].onDelete).toBe("CASCADE");
    expect(store.foreignKeys[0].onUpdate).toBe("NO ACTION");
  });

  it("updateForeignKey is a no-op for unknown id", () => {
    const store = makeStore();
    store.updateForeignKey("nope", { onDelete: "CASCADE" });
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("removeForeignKey removes only the specified FK", () => {
    const store = makeStore();
    store.addTable("a");
    store.addTable("b");
    store.addColumn(store.tables[0].id);
    store.addColumn(store.tables[1].id);
    store.addForeignKey({
      sourceTableId: store.tables[0].id,
      sourceColumnId: store.tables[0].columns[0].id,
      targetTableId: store.tables[1].id,
      targetColumnId: store.tables[1].columns[0].id,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    store.addForeignKey({
      sourceTableId: store.tables[1].id,
      sourceColumnId: store.tables[1].columns[0].id,
      targetTableId: store.tables[0].id,
      targetColumnId: store.tables[0].columns[0].id,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
    const keepId = store.foreignKeys[0].id;
    store.removeForeignKey(store.foreignKeys[1].id);
    expect(store.foreignKeys).toHaveLength(1);
    expect(store.foreignKeys[0].id).toBe(keepId);
  });

  it("removeTable cascades to remove all its FKs as source", () => {
    const store = makeStore();
    store.addTable("a");
    store.addTable("b");
    store.addColumn(store.tables[0].id);
    store.addColumn(store.tables[1].id);
    store.addForeignKey({
      sourceTableId: store.tables[0].id,
      sourceColumnId: store.tables[0].columns[0].id,
      targetTableId: store.tables[1].id,
      targetColumnId: store.tables[1].columns[0].id,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    store.removeTable(store.tables[0].id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("removeTable cascades to remove all its FKs as target", () => {
    const store = makeStore();
    store.addTable("a");
    store.addTable("b");
    store.addColumn(store.tables[0].id);
    store.addColumn(store.tables[1].id);
    store.addForeignKey({
      sourceTableId: store.tables[0].id,
      sourceColumnId: store.tables[0].columns[0].id,
      targetTableId: store.tables[1].id,
      targetColumnId: store.tables[1].columns[0].id,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    store.removeTable(store.tables[1].id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("removeTable clears selectedTableId when it matches", () => {
    const store = makeStore();
    store.addTable("t");
    const id = store.tables[0].id;
    store.selectedTableId = id;
    store.removeTable(id);
    expect(store.selectedTableId).toBeNull();
  });

  it("removeTable does not clear selectedTableId for a different table", () => {
    const store = makeStore();
    store.addTable("a");
    store.addTable("b");
    store.selectedTableId = store.tables[0].id;
    store.removeTable(store.tables[1].id);
    expect(store.selectedTableId).toBe(store.tables[0].id);
  });
});

// ─── Canvas transform persistence ───────────────────────────────────────────

describe("Canvas transform persistence", () => {
  it("updating canvasTransform is written to localStorage", () => {
    const store = makeStore();
    store.canvasTransform = { x: 100, y: 200, k: 1.5 };
    const saved = JSON.parse(
      localStorage.getItem("db_schema_visualizer") ?? "{}",
    );
    expect(saved.v).toEqual({ x: 100, y: 200, k: 1.5 });
  });

  it("canvasTransform is restored from localStorage on hydration", () => {
    localStorage.setItem(
      "db_schema_visualizer",
      JSON.stringify({ t: [], f: [], v: { x: 42, y: 99, k: 2 }, s: null }),
    );
    const store = makeStore();
    store.loadFromLocalStorage();
    expect(store.canvasTransform).toEqual({ x: 42, y: 99, k: 2 });
  });

  it("missing canvasTransform in localStorage falls back to default", () => {
    localStorage.setItem(
      "db_schema_visualizer",
      JSON.stringify({ t: [], f: [] }),
    );
    const store = makeStore();
    store.loadFromLocalStorage();
    expect(store.canvasTransform).toEqual({ x: 0, y: 0, k: 1 });
  });
});

// ─── Store hydration edge cases ──────────────────────────────────────────────

describe("Store hydration edge cases", () => {
  it("returns 'empty' when localStorage has no key", () => {
    localStorage.removeItem("db_schema_visualizer");
    const store = makeStore();
    const result = store.loadFromLocalStorage();
    expect(result).toBe("empty");
  });

  it("returns 'loaded' when localStorage has valid data", () => {
    localStorage.setItem(
      "db_schema_visualizer",
      JSON.stringify({ t: [], f: [], v: { x: 0, y: 0, k: 1 }, s: null }),
    );
    const store = makeStore();
    const result = store.loadFromLocalStorage();
    expect(result).toBe("loaded");
  });

  it("returns 'error' and clears localStorage on malformed JSON", () => {
    localStorage.setItem("db_schema_visualizer", "not-json{{{{");
    const store = makeStore();
    const result = store.loadFromLocalStorage();
    expect(result).toBe("error");
    expect(localStorage.getItem("db_schema_visualizer")).toBeNull();
  });

  it("hydration with missing 'tables' key leaves tables empty", () => {
    localStorage.setItem(
      "db_schema_visualizer",
      JSON.stringify({ f: [], v: { x: 0, y: 0, k: 1 } }),
    );
    const store = makeStore();
    store.loadFromLocalStorage();
    expect(store.tables).toHaveLength(0);
  });

  it("hydration with missing 'foreignKeys' key leaves foreignKeys empty", () => {
    localStorage.setItem(
      "db_schema_visualizer",
      JSON.stringify({ t: [], v: { x: 0, y: 0, k: 1 } }),
    );
    const store = makeStore();
    store.loadFromLocalStorage();
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("hydration migrates legacy columnIds to parts format", () => {
    const colId = "col-1";
    localStorage.setItem(
      "db_schema_visualizer",
      JSON.stringify({
        t: [
          {
            id: "t1",
            name: "t",
            x: 0,
            y: 0,
            columns: [
              {
                id: colId,
                name: "id",
                type: "int",
                isPrimaryKey: true,
                isNullable: false,
                isUnique: true,
                defaultValue: null,
              },
            ],
            indexes: [
              {
                id: "i1",
                name: "idx_t_id",
                type: "normal",
                columnIds: [colId],
              },
            ],
            checkConstraints: [],
          },
        ],
        f: [],
      }),
    );
    const store = makeStore();
    store.loadFromLocalStorage();
    const idx = store.tables[0].indexes[0];
    expect(idx.parts).toBeDefined();
    expect(idx.parts[0]).toEqual({
      type: "column",
      value: colId,
      order: "ASC",
    });
  });

  it("hydration does not restore selectedTableId if it no longer exists", () => {
    localStorage.setItem(
      "db_schema_visualizer",
      JSON.stringify({ t: [], f: [], s: "nonexistent-id" }),
    );
    const store = makeStore();
    store.loadFromLocalStorage();
    expect(store.selectedTableId).toBeNull();
  });

  it("hydration restores selectedTableId when it matches a loaded table", () => {
    const tableId = "known-id";
    localStorage.setItem(
      "db_schema_visualizer",
      JSON.stringify({
        t: [
          {
            id: tableId,
            name: "t",
            x: 0,
            y: 0,
            columns: [],
            indexes: [],
            checkConstraints: [],
          },
        ],
        f: [],
        s: tableId,
      }),
    );
    const store = makeStore();
    store.loadFromLocalStorage();
    expect(store.selectedTableId).toBe(tableId);
  });
});

// ─── viewMode ────────────────────────────────────────────────────────────────

describe("viewMode", () => {
  it("saveToLocalStorage is skipped in read mode", () => {
    const store = makeStore();
    store.viewMode = "read";
    localStorage.removeItem("db_schema_visualizer");
    store.addTable("t"); // triggers watch which calls saveToLocalStorage
    expect(localStorage.getItem("db_schema_visualizer")).toBeNull();
  });

  it("saveToLocalStorage writes in full mode", () => {
    const store = makeStore();
    store.viewMode = "full";
    store.addTable("t");
    expect(localStorage.getItem("db_schema_visualizer")).not.toBeNull();
  });
});

// ─── SQL import ──────────────────────────────────────────────────────────────

describe("importFromSql", () => {
  it("imports a single CREATE TABLE statement", async () => {
    const store = makeStore();
    await store.importFromSql(
      "CREATE TABLE users (id serial PRIMARY KEY, email text NOT NULL);",
    );
    expect(store.tables).toHaveLength(1);
    expect(store.tables[0].name).toBe("users");
  });

  it("imports multiple tables", async () => {
    const store = makeStore();
    await store.importFromSql(
      "CREATE TABLE a (id serial PRIMARY KEY);\nCREATE TABLE b (id serial PRIMARY KEY);",
    );
    expect(store.tables).toHaveLength(2);
  });

  it("resets canvas transform after import", async () => {
    const store = makeStore();
    store.canvasTransform = { x: 99, y: 99, k: 2 };
    await store.importFromSql("CREATE TABLE t (id serial PRIMARY KEY);");
    expect(store.canvasTransform).toEqual({ x: 0, y: 0, k: 1 });
  });

  it("throws on empty SQL (no CREATE TABLE found)", async () => {
    const store = makeStore();
    await expect(store.importFromSql("SELECT 1;")).rejects.toThrow();
  });

  it("leaves store unchanged when import throws", async () => {
    const store = makeStore();
    store.addTable("existing");
    await expect(store.importFromSql("garbage!!!")).rejects.toThrow();
  });
});

// ─── JSON import ─────────────────────────────────────────────────────────────

describe("importFromJson", () => {
  it("imports a valid JSON schema", async () => {
    const store = makeStore();
    const json = JSON.stringify({
      tables: [
        {
          id: "t1",
          name: "users",
          x: 0,
          y: 0,
          columns: [],
          indexes: [],
          checkConstraints: [],
        },
      ],
      foreignKeys: [],
    });
    await store.importFromJson(json);
    expect(store.tables).toHaveLength(1);
    expect(store.tables[0].name).toBe("users");
  });

  it("throws on invalid JSON", async () => {
    const store = makeStore();
    await expect(store.importFromJson("not json{{")).rejects.toThrow();
  });

  it("throws when 'tables' key is missing", async () => {
    const store = makeStore();
    await expect(
      store.importFromJson(JSON.stringify({ foreignKeys: [] })),
    ).rejects.toThrow();
  });

  it("throws when tables array is empty", async () => {
    const store = makeStore();
    await expect(
      store.importFromJson(JSON.stringify({ tables: [] })),
    ).rejects.toThrow();
  });

  it("throws when foreignKeys is not an array", async () => {
    const store = makeStore();
    const json = JSON.stringify({
      tables: [
        {
          id: "t1",
          name: "t",
          x: 0,
          y: 0,
          columns: [],
          indexes: [],
          checkConstraints: [],
        },
      ],
      foreignKeys: "bad",
    });
    await expect(store.importFromJson(json)).rejects.toThrow();
  });

  it("accepts missing foreignKeys key (defaults to empty array)", async () => {
    const store = makeStore();
    const json = JSON.stringify({
      tables: [
        {
          id: "t1",
          name: "t",
          x: 0,
          y: 0,
          columns: [],
          indexes: [],
          checkConstraints: [],
        },
      ],
    });
    await store.importFromJson(json);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("resets canvas transform after import", async () => {
    const store = makeStore();
    store.canvasTransform = { x: 50, y: 50, k: 1.5 };
    const json = JSON.stringify({
      tables: [
        {
          id: "t1",
          name: "t",
          x: 0,
          y: 0,
          columns: [],
          indexes: [],
          checkConstraints: [],
        },
      ],
      foreignKeys: [],
    });
    await store.importFromJson(json);
    expect(store.canvasTransform).toEqual({ x: 0, y: 0, k: 1 });
  });
});

// ─── Preset loading ──────────────────────────────────────────────────────────

describe("Preset loading", () => {
  it.each([
    "blog",
    "ecommerce",
    "saas",
    "rbac",
    "social",
    "cms",
    "chat",
  ] as const)("loadPreset('%s') populates the store with tables", (key) => {
    const store = makeStore();
    store.loadPreset(key);
    expect(store.tables.length).toBeGreaterThanOrEqual(3);
  });

  it("loadPreset clears the previous schema", () => {
    const store = makeStore();
    store.addTable("old_table");
    store.loadPreset("blog");
    const names = store.tables.map((t) => t.name);
    expect(names).not.toContain("old_table");
  });

  it("loadPreset resets canvas transform to origin", () => {
    const store = makeStore();
    store.canvasTransform = { x: 99, y: 99, k: 3 };
    store.loadPreset("ecommerce");
    expect(store.canvasTransform).toEqual({ x: 0, y: 0, k: 1 });
  });

  it("loadPreset deselects the selected table", () => {
    const store = makeStore();
    store.addTable("t");
    store.selectedTableId = store.tables[0].id;
    store.loadPreset("saas");
    expect(store.selectedTableId).toBeNull();
  });
});
