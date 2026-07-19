import { describe, it, expect } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSchemaStore } from "../schemaStore";
import type { MigrationFile } from "../../utils/migrationFold";

function makeStore() {
  setActivePinia(createPinia());
  return useSchemaStore();
}

const file = (version: string, sql: string): MigrationFile => ({ version, sql });

describe("importFromMigrationHistory", () => {
  it("folds multiple ordered files into the store's tables/foreignKeys", async () => {
    const store = makeStore();
    await store.importFromMigrationHistory([
      file("1", `CREATE TABLE posts (id INT PRIMARY KEY);`),
      file("2", `CREATE TABLE comments (id INT PRIMARY KEY, post_id INT);`),
      file(
        "3",
        `ALTER TABLE comments ADD CONSTRAINT fk_post FOREIGN KEY (post_id) REFERENCES posts (id);`,
      ),
    ]);

    expect(store.tables).toHaveLength(2);
    expect(store.foreignKeys).toHaveLength(1);
    expect(store.tables.map((t) => t.name).sort()).toEqual(["comments", "posts"]);
  });

  it("resets canvas transform and selection, and grid-layouts new tables", async () => {
    const store = makeStore();
    store.canvasTransform = { x: 99, y: 99, k: 2 };
    await store.importFromMigrationHistory([
      file("1", `CREATE TABLE t (id INT PRIMARY KEY);`),
    ]);
    expect(store.canvasTransform).toEqual({ x: 0, y: 0, k: 1 });
    expect(store.selectedTableId).toBeNull();
    expect(store.tables[0].x).toBeGreaterThanOrEqual(0);
  });

  it("captures importedBaseline as an independent deep clone of the folded snapshot", async () => {
    const store = makeStore();
    await store.importFromMigrationHistory([
      file("1", `CREATE TABLE t (id INT PRIMARY KEY, name TEXT);`),
    ]);
    expect(store.importedBaseline).not.toBeNull();
    expect(store.importedBaseline!.tables).toHaveLength(1);

    // Mutating live state after import must not affect the retained baseline.
    store.addColumn(store.tables[0].id);
    expect(store.tables[0].columns).toHaveLength(3);
    expect(store.importedBaseline!.tables[0].columns).toHaveLength(2);
  });

  it("records the fold's per-file history on importedHistory", async () => {
    const store = makeStore();
    await store.importFromMigrationHistory([
      file("1", `CREATE TABLE t (id INT PRIMARY KEY);`),
      file("2", `ALTER TABLE t ADD COLUMN name TEXT;`),
    ]);
    expect(store.importedHistory).toHaveLength(2);
  });

  it("throws when folding produces zero tables, leaving the store unchanged", async () => {
    const store = makeStore();
    store.addTable("existing");
    await expect(
      store.importFromMigrationHistory([file("1", `-- no statements here`)]),
    ).rejects.toThrow();
    expect(store.tables).toHaveLength(1);
    expect(store.tables[0].name).toBe("existing");
  });

  it("sorts files by version internally even if passed out of order", async () => {
    const store = makeStore();
    await store.importFromMigrationHistory([
      file("2", `ALTER TABLE t ADD COLUMN b INT;`),
      file("1", `CREATE TABLE t (a INT);`),
    ]);
    expect(store.tables[0].columns.map((c) => c.name)).toEqual(["a", "b"]);
  });
});

describe("importedBaseline uniformity across import actions", () => {
  it("importFromSql also sets importedBaseline", async () => {
    const store = makeStore();
    await store.importFromSql("CREATE TABLE t (id serial PRIMARY KEY);");
    expect(store.importedBaseline).not.toBeNull();
    expect(store.importedBaseline!.tables).toHaveLength(1);
  });

  it("importFromJson also sets importedBaseline", async () => {
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
      foreignKeys: [],
    });
    await store.importFromJson(json);
    expect(store.importedBaseline).not.toBeNull();
    expect(store.importedBaseline!.tables).toHaveLength(1);
  });
});
