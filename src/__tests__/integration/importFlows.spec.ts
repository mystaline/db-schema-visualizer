/**
 * Integration: SQL import, preset loading, localStorage persistence, URL share
 * Covers: schemaStore importFromSql/importFromJson/loadPreset/loadFromLocalStorage
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSchemaStore } from "../../stores/schemaStore";
import { parseDDL } from "../../utils/ddlParser";
import { PRESET_REGISTRY } from "../../utils/presets/index";

function makeStore() {
  setActivePinia(createPinia());
  return useSchemaStore();
}

const SIMPLE_DDL = `
CREATE TABLE users (
  id UUID NOT NULL,
  email TEXT NOT NULL UNIQUE,
  PRIMARY KEY (id)
);
CREATE TABLE posts (
  id UUID NOT NULL,
  user_id UUID,
  title TEXT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX idx_posts_user ON posts (user_id);
`;

// ─── SQL import ───────────────────────────────────────────────────────────────

describe("SQL import", () => {
  it("pasting valid CREATE TABLE SQL populates the store with tables", async () => {
    const store = makeStore();
    await store.importFromSql(SIMPLE_DDL);
    expect(store.tables.length).toBeGreaterThanOrEqual(2);
    const names = store.tables.map((t) => t.name);
    expect(names).toContain("users");
    expect(names).toContain("posts");
  });

  it("importing SQL with FOREIGN KEY constraints creates FK entries", async () => {
    const store = makeStore();
    await store.importFromSql(SIMPLE_DDL);
    expect(store.foreignKeys).toHaveLength(1);
    const fk = store.foreignKeys[0];
    const src = store.tables.find((t) => t.name === "posts")!;
    const tgt = store.tables.find((t) => t.name === "users")!;
    expect(fk.sourceTableId).toBe(src.id);
    expect(fk.targetTableId).toBe(tgt.id);
  });

  it("importing SQL with CREATE INDEX creates index entries", async () => {
    const store = makeStore();
    await store.importFromSql(SIMPLE_DDL);
    const posts = store.tables.find((t) => t.name === "posts")!;
    expect(posts.indexes.length).toBeGreaterThanOrEqual(1);
  });

  it("importing replaces the current schema", async () => {
    const store = makeStore();
    store.addTable("old_table");
    expect(store.tables).toHaveLength(1);
    await store.importFromSql(SIMPLE_DDL);
    expect(store.tables.some((t) => t.name === "old_table")).toBe(false);
  });

  it("importing resets canvas transform to origin", async () => {
    const store = makeStore();
    store.canvasTransform.x = 999;
    store.canvasTransform.y = 888;
    await store.importFromSql(SIMPLE_DDL);
    expect(store.canvasTransform.x).toBe(0);
    expect(store.canvasTransform.y).toBe(0);
    expect(store.canvasTransform.k).toBe(1);
  });

  it("importing clears selected table", async () => {
    const store = makeStore();
    store.addTable("x");
    store.selectedTableId = store.tables[0].id;
    await store.importFromSql(SIMPLE_DDL);
    expect(store.selectedTableId).toBeNull();
  });

  it("invalid SQL throws an error and leaves the store unchanged", async () => {
    const store = makeStore();
    store.addTable("existing");
    await expect(
      store.importFromSql("NOT VALID SQL AT ALL !!!"),
    ).rejects.toThrow();
    expect(store.tables.some((t) => t.name === "existing")).toBe(true);
  });

  it("empty SQL throws an error (no CREATE TABLE found)", async () => {
    const store = makeStore();
    await expect(store.importFromSql("-- just a comment")).rejects.toThrow();
  });

  it("parseDDL parses multiple tables correctly", () => {
    const result = parseDDL(SIMPLE_DDL);
    expect(result.tables.map((t) => t.name)).toContain("users");
    expect(result.tables.map((t) => t.name)).toContain("posts");
  });

  it("parseDDL extracts UNIQUE constraint on column", () => {
    const result = parseDDL(SIMPLE_DDL);
    const users = result.tables.find((t) => t.name === "users")!;
    const email = users.columns.find((c) => c.name === "email")!;
    expect(email.isUnique).toBe(true);
  });
});

// ─── Preset loading ───────────────────────────────────────────────────────────

describe("Preset loading", () => {
  it.each(PRESET_REGISTRY.map((p) => [p.key, p.label]))(
    "loading '%s' preset (%s) populates store with ≥3 tables",
    (key) => {
      const store = makeStore();
      store.loadPreset(key as Parameters<typeof store.loadPreset>[0]);
      expect(store.tables.length).toBeGreaterThanOrEqual(3);
    },
  );

  it("loading a preset clears the previous schema", () => {
    const store = makeStore();
    store.addTable("old_table");
    store.loadPreset("blog");
    expect(store.tables.some((t) => t.name === "old_table")).toBe(false);
  });

  it("loading a preset resets canvas transform to origin", () => {
    const store = makeStore();
    store.canvasTransform.x = 500;
    store.loadPreset("ecommerce");
    expect(store.canvasTransform).toEqual({ x: 0, y: 0, k: 1 });
  });

  it("loading a preset deselects the selected table", () => {
    const store = makeStore();
    store.addTable("t");
    store.selectedTableId = store.tables[0].id;
    store.loadPreset("saas");
    expect(store.selectedTableId).toBeNull();
  });

  it("all 7 presets are in PRESET_REGISTRY", () => {
    expect(PRESET_REGISTRY).toHaveLength(7);
    const keys = PRESET_REGISTRY.map((p) => p.key);
    expect(keys).toContain("blog");
    expect(keys).toContain("ecommerce");
    expect(keys).toContain("saas");
    expect(keys).toContain("rbac");
    expect(keys).toContain("social");
    expect(keys).toContain("cms");
    expect(keys).toContain("chat");
  });
});

// ─── LocalStorage persistence ─────────────────────────────────────────────────

describe("LocalStorage persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("schema is saved to localStorage after adding a table", () => {
    const store = makeStore();
    store.addTable("tracked_table");
    const raw = localStorage.getItem("db_schema_visualizer");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(
      parsed.t.some((t: { name: string }) => t.name === "tracked_table"),
    ).toBe(true);
  });

  it("on load, schema is hydrated from localStorage", () => {
    // Seed localStorage using the store's own key and data format
    const seed = {
      t: [
        {
          id: "t1",
          name: "seed_table",
          columns: [],
          indexes: [],
          checkConstraints: [],
          x: 0,
          y: 0,
        },
      ],
      f: [],
      v: { x: 0, y: 0, k: 1 },
      s: null,
    };
    localStorage.setItem("db_schema_visualizer", JSON.stringify(seed));

    const store = makeStore();
    store.loadFromLocalStorage();
    expect(store.tables.some((t) => t.name === "seed_table")).toBe(true);
  });

  it("if localStorage is corrupt, app loads with empty canvas", () => {
    localStorage.setItem("db_schema_visualizer", "{ not valid json {{");
    const store = makeStore();
    store.loadFromLocalStorage();
    expect(store.tables).toHaveLength(0);
  });

  it("canvas transform is persisted and restored", () => {
    const store = makeStore();
    store.canvasTransform.x = 123;
    store.canvasTransform.y = 456;
    store.canvasTransform.k = 1.5;
    store.addTable("anchor"); // triggers save via watcher
    const raw = localStorage.getItem("db_schema_visualizer");
    const parsed = JSON.parse(raw!);
    expect(parsed.v).toEqual({ x: 123, y: 456, k: 1.5 });
  });

  it("selectedTableId is persisted and restored if table still exists", () => {
    const store = makeStore();
    store.addTable("selected");
    const tableId = store.tables[0].id;
    store.selectedTableId = tableId; // triggers save via watcher

    // Simulate reload: new store hydrates from localStorage
    const store2 = makeStore();
    store2.loadFromLocalStorage();
    expect(store2.selectedTableId).toBe(tableId);
  });
});

// ─── URL share import ─────────────────────────────────────────────────────────

describe("URL share import", () => {
  it("getShareableData encodes current schema to a string", async () => {
    const store = makeStore();
    await store.importFromSql(SIMPLE_DDL);
    const data = await store.getShareableData();
    expect(typeof data).toBe("string");
    expect(data.length).toBeGreaterThan(10);
  });

  it("loadFromShareableData restores the schema", async () => {
    const store = makeStore();
    await store.importFromSql(SIMPLE_DDL);
    const encoded = await store.getShareableData();

    const store2 = makeStore();
    await store2.loadFromShareableData(encoded);
    const names = store2.tables.map((t) => t.name);
    expect(names).toContain("users");
    expect(names).toContain("posts");
  });

  it("corrupt share URL payload returns false and resets to empty schema", async () => {
    const store = makeStore();
    store.addTable("existing");
    const result = await store.loadFromShareableData("NOTVALIDBASE64$$$$%%%");
    expect(result).toBe(false);
    expect(store.tables).toHaveLength(0);
  });
});

// ─── importFromJson ────────────────────────────────────────────────────────────

describe("importFromJson", () => {
  it("valid JSON with tables array populates the store", async () => {
    const store = makeStore();
    const json = JSON.stringify({
      tables: [
        {
          id: "t1",
          name: "json_table",
          columns: [],
          indexes: [],
          checkConstraints: [],
          x: 0,
          y: 0,
        },
      ],
      foreignKeys: [],
    });
    await store.importFromJson(json);
    expect(store.tables.some((t) => t.name === "json_table")).toBe(true);
  });

  it("invalid JSON throws", async () => {
    const store = makeStore();
    await expect(store.importFromJson("not json")).rejects.toThrow();
  });

  it("JSON without tables array throws", async () => {
    const store = makeStore();
    await expect(store.importFromJson('{"foreignKeys":[]}')).rejects.toThrow();
  });
});
