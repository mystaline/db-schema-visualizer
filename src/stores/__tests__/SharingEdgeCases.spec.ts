import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../schemaStore";

describe("Sharing & Serialization Edge Cases", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("Sharing with special characters", () => {
    it("preserves special characters in table and column names", async () => {
      const store = useSchemaStore();

      store.addTable("user_profile");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      store.updateColumn(tId, store.tables[0].columns[0].id, {
        name: "first@name",
        type: "varchar(100)"
      });

      const shared = await store.getShareableData("full");
      store.tables = [];

      await store.loadFromShareableData(shared);

      expect(store.tables[0].name).toBe("user_profile");
      expect(store.tables[0].columns[0].name).toBe("first@name");
    });

    it("handles quotes and escape sequences in expressions", async () => {
      const store = useSchemaStore();

      store.addTable("products");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;
      store.updateColumn(tId, colId, { name: "title" });

      store.tables[0].checkConstraints.push({
        id: "chk_1",
        name: "chk_title",
        expression: "title LIKE 'Product %' OR title LIKE \"Service %\""
      });

      const shared = await store.getShareableData("full");
      store.tables = [];

      await store.loadFromShareableData(shared);

      expect(store.tables[0].checkConstraints[0].expression)
        .toBe("title LIKE 'Product %' OR title LIKE \"Service %\"");
    });

    it("preserves unicode characters in names and expressions", async () => {
      const store = useSchemaStore();

      store.addTable("用户");  // Chinese for "users"
      const tId = store.tables[0].id;
      store.addColumn(tId);
      store.updateColumn(tId, store.tables[0].columns[0].id, {
        name: "名字", // Chinese for "name"
        type: "text"
      });

      const shared = await store.getShareableData("full");
      store.tables = [];

      await store.loadFromShareableData(shared);

      expect(store.tables[0].name).toBe("用户");
      expect(store.tables[0].columns[0].name).toBe("名字");
    });
  });

  describe("Sharing complex schemas", () => {
    it("handles large complex schemas with many tables and relationships", async () => {
      const store = useSchemaStore();

      // Create 10 tables
      for (let i = 0; i < 10; i++) {
        store.addTable(`table_${i}`);
        const tId = store.tables[i].id;

        // Add 5 columns per table
        for (let j = 0; j < 5; j++) {
          store.addColumn(tId);
          store.updateColumn(tId, store.tables[i].columns[j].id, {
            name: `col_${j}`,
            type: j === 0 ? "uuid" : "text",
            isPrimaryKey: j === 0
          });
        }

        // Add indexes
        store.addIndex(tId, {
          name: `idx_${i}`,
          type: "normal",
          parts: [{ type: "column", value: store.tables[i].columns[0].id, order: "ASC" }],
          filter: ""
        });
      }

      // Create cross-table foreign keys
      for (let i = 1; i < 10; i++) {
        store.addForeignKey({
          sourceTableId: store.tables[i].id,
          sourceColumnId: store.tables[i].columns[1].id,
          targetTableId: store.tables[0].id,
          targetColumnId: store.tables[0].columns[0].id,
          onDelete: "CASCADE",
          onUpdate: "CASCADE"
        });
      }

      const shared = await store.getShareableData("full");
      const initialTableCount = store.tables.length;
      const initialFKCount = store.foreignKeys.length;

      store.tables = [];
      store.foreignKeys = [];

      await store.loadFromShareableData(shared);

      expect(store.tables).toHaveLength(initialTableCount);
      expect(store.foreignKeys).toHaveLength(initialFKCount);
    });

    it("preserves schema structure during sharing even without canvas state", async () => {
      const store = useSchemaStore();

      store.addTable("users");
      store.addTable("posts");
      const tableId = store.tables[0].id;

      const shared = await store.getShareableData("full");

      // Clear and reload
      store.tables = [];

      await store.loadFromShareableData(shared);

      expect(store.tables).toHaveLength(2);
      expect(store.tables[0].name).toBe("users");
      expect(store.tables[1].name).toBe("posts");
    });
  });

  describe("View mode persistence", () => {
    it("preserves read-only mode in shared link", async () => {
      const store = useSchemaStore();

      store.addTable("users");
      store.addColumn(store.tables[0].id);

      const shared = await store.getShareableData("read");

      // Clear and reload
      store.viewMode = "full";
      store.tables = [];

      await store.loadFromShareableData(shared);

      expect(store.viewMode).toBe("read");
    });

    it("preserves full access mode in shared link", async () => {
      const store = useSchemaStore();

      store.addTable("users");
      store.addColumn(store.tables[0].id);

      const shared = await store.getShareableData("full");

      // Clear and reload
      store.viewMode = "read";
      store.tables = [];

      await store.loadFromShareableData(shared);

      expect(store.viewMode).toBe("full");
    });
  });

  describe("Sharing with composite indexes and constraints", () => {
    it("preserves composite indexes during sharing", async () => {
      const store = useSchemaStore();

      store.addTable("orders");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      store.addColumn(tId);
      const col1 = store.tables[0].columns[0].id;
      const col2 = store.tables[0].columns[1].id;

      store.addIndex(tId, {
        name: "idx_composite",
        type: "unique",
        parts: [
          { type: "column", value: col1, order: "ASC" },
          { type: "column", value: col2, order: "DESC" }
        ],
        filter: "status = 'active'"
      });

      const shared = await store.getShareableData("full");
      store.tables = [];

      await store.loadFromShareableData(shared);

      const index = store.tables[0].indexes[0];
      expect(index.parts).toHaveLength(2);
      expect(index.parts[0].order).toBe("ASC");
      expect(index.parts[1].order).toBe("DESC");
      expect(index.filter).toBe("status = 'active'");
    });

    it("preserves complex check constraints during sharing", async () => {
      const store = useSchemaStore();

      store.addTable("users");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      store.updateColumn(tId, store.tables[0].columns[0].id, { name: "age" });

      store.tables[0].checkConstraints.push({
        id: "chk_1",
        name: "age_range",
        expression: "age >= 18 AND age <= 120"
      });

      const shared = await store.getShareableData("full");
      store.tables = [];

      await store.loadFromShareableData(shared);

      expect(store.tables[0].checkConstraints[0].expression)
        .toBe("age >= 18 AND age <= 120");
    });
  });

  describe("Empty and minimal schemas", () => {
    it("handles empty schema sharing", async () => {
      const store = useSchemaStore();

      const shared = await store.getShareableData("full");
      expect(typeof shared).toBe("string");
      expect(shared.length).toBeGreaterThan(0);

      await store.loadFromShareableData(shared);
      expect(store.tables).toHaveLength(0);
    });

    it("handles schema with single table and no columns", async () => {
      const store = useSchemaStore();

      store.addTable("empty_table");

      const shared = await store.getShareableData("full");
      store.tables = [];

      await store.loadFromShareableData(shared);

      expect(store.tables).toHaveLength(1);
      expect(store.tables[0].name).toBe("empty_table");
      expect(store.tables[0].columns).toHaveLength(0);
    });

    it("handles schema with only default values", async () => {
      const store = useSchemaStore();

      store.addTable("config");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      store.updateColumn(tId, store.tables[0].columns[0].id, {
        name: "setting",
        type: "text",
        defaultValue: "default_value"
      });

      const shared = await store.getShareableData("full");
      store.tables = [];

      await store.loadFromShareableData(shared);

      expect(store.tables[0].columns[0].defaultValue).toBe("default_value");
    });
  });

  describe("Backward compatibility", () => {
    it("loads schemas with modern index format (parts)", async () => {
      // This tests that modern index format is preserved correctly
      const store = useSchemaStore();

      store.addTable("users");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;

      // Add modern format index (parts-based)
      store.addIndex(tId, {
        name: "idx_modern",
        type: "normal",
        parts: [{ type: "column", value: colId, order: "ASC" }],
        filter: ""
      });

      const shared = await store.getShareableData("full");
      store.tables = [];

      await store.loadFromShareableData(shared);

      // Should have loaded successfully with parts intact
      expect(store.tables[0].indexes).toHaveLength(1);
      expect(store.tables[0].indexes[0].parts).toHaveLength(1);
      expect(store.tables[0].indexes[0].parts[0].type).toBe("column");
    });
  });
});
