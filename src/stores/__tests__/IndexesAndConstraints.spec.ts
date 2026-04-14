import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../schemaStore";

describe("Indexes & Check Constraints", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("Index CRUD", () => {
    it("adds and removes indexes", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;

      store.addIndex(tId, {
        name: "idx_users_email",
        type: "normal",
        parts: [{ type: "column", value: colId, order: "ASC" }],
        filter: ""
      });

      expect(store.tables[0].indexes).toHaveLength(1);
      expect(store.tables[0].indexes[0].name).toBe("idx_users_email");

      const indexId = store.tables[0].indexes[0].id;
      store.removeIndex(tId, indexId);
      expect(store.tables[0].indexes).toHaveLength(0);
    });

    it("handles composite indexes (multiple columns)", () => {
      const store = useSchemaStore();
      store.addTable("orders");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      store.addColumn(tId);
      const col1 = store.tables[0].columns[0].id;
      const col2 = store.tables[0].columns[1].id;

      store.addIndex(tId, {
        name: "idx_orders_composite",
        type: "normal",
        parts: [
          { type: "column", value: col1, order: "ASC" },
          { type: "column", value: col2, order: "DESC" }
        ],
        filter: ""
      });

      const index = store.tables[0].indexes[0];
      expect(index.parts).toHaveLength(2);
      expect(index.parts[0].order).toBe("ASC");
      expect(index.parts[1].order).toBe("DESC");
    });

    it("handles expression indexes", () => {
      const store = useSchemaStore();
      store.addTable("products");
      const tId = store.tables[0].id;

      store.addIndex(tId, {
        name: "idx_products_lower",
        type: "normal",
        parts: [{ type: "expression", value: "LOWER(name)", order: "ASC" }],
        filter: ""
      });

      const index = store.tables[0].indexes[0];
      expect(index.parts[0].type).toBe("expression");
      expect(index.parts[0].value).toBe("LOWER(name)");
    });

    it("handles filtered (partial) indexes", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;

      store.addIndex(tId, {
        name: "idx_users_active",
        type: "normal",
        parts: [{ type: "column", value: colId, order: "ASC" }],
        filter: "status = 'active'"
      });

      const index = store.tables[0].indexes[0];
      expect(index.filter).toBe("status = 'active'");
    });

    it("creates unique indexes", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;

      store.addIndex(tId, {
        name: "idx_users_email_unique",
        type: "unique",
        parts: [{ type: "column", value: colId, order: "ASC" }],
        filter: ""
      });

      expect(store.tables[0].indexes[0].type).toBe("unique");
    });

    it("allows duplicate index names on same table", () => {
      const store = useSchemaStore();
      store.addTable("items");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;

      store.addIndex(tId, {
        name: "idx_items",
        type: "normal",
        parts: [{ type: "column", value: colId, order: "ASC" }],
        filter: ""
      });

      store.addIndex(tId, {
        name: "idx_items",
        type: "normal",
        parts: [{ type: "column", value: colId, order: "ASC" }],
        filter: ""
      });

      // Both indexes are created with same name (no auto-resolution)
      expect(store.tables[0].indexes).toHaveLength(2);
      expect(store.tables[0].indexes[0].name).toBe("idx_items");
      expect(store.tables[0].indexes[1].name).toBe("idx_items");
    });
  });

  describe("Check Constraints CRUD", () => {
    it("adds and removes check constraints", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tId = store.tables[0].id;
      store.addColumn(tId);

      store.tables[0].checkConstraints.push({
        id: "chk_1",
        name: "chk_age_positive",
        expression: "age > 0"
      });

      expect(store.tables[0].checkConstraints).toHaveLength(1);

      store.tables[0].checkConstraints = [];
      expect(store.tables[0].checkConstraints).toHaveLength(0);
    });

    it("validates constraint expressions on column rename", () => {
      const store = useSchemaStore();
      store.addTable("products");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;
      store.updateColumn(tId, colId, { name: "price" });

      store.tables[0].checkConstraints.push({
        id: "chk_1",
        name: "chk_price_positive",
        expression: "price > 0"
      });

      expect(store.tables[0].checkConstraints[0].expression).toBe("price > 0");

      // Rename column: price -> unit_price
      store.updateColumn(tId, colId, { name: "unit_price" });

      // Expression should be updated
      expect(store.tables[0].checkConstraints[0].expression).toBe("unit_price > 0");
    });

    it("handles multiple constraints with same column name", () => {
      const store = useSchemaStore();
      store.addTable("orders");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;
      store.updateColumn(tId, colId, { name: "quantity" });

      store.tables[0].checkConstraints.push(
        {
          id: "chk_1",
          name: "chk_qty_positive",
          expression: "quantity > 0"
        },
        {
          id: "chk_2",
          name: "chk_qty_max",
          expression: "quantity <= 1000"
        }
      );

      store.updateColumn(tId, colId, { name: "item_qty" });

      expect(store.tables[0].checkConstraints[0].expression).toBe("item_qty > 0");
      expect(store.tables[0].checkConstraints[1].expression).toBe("item_qty <= 1000");
    });

    it("allows duplicate constraint names", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tId = store.tables[0].id;
      store.addColumn(tId);

      store.tables[0].checkConstraints.push(
        {
          id: "chk_1",
          name: "chk_validation",
          expression: "age > 0"
        },
        {
          id: "chk_2",
          name: "chk_validation",
          expression: "status IN ('active', 'inactive')"
        }
      );

      // Duplicate names are allowed (manual management)
      expect(store.tables[0].checkConstraints).toHaveLength(2);
      expect(store.tables[0].checkConstraints[0].name).toBe("chk_validation");
      expect(store.tables[0].checkConstraints[1].name).toBe("chk_validation");
    });
  });

  describe("Index & Constraint Refactoring", () => {
    it("updates index names when table is renamed", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;
      store.updateColumn(tId, colId, { name: "email" });

      store.addIndex(tId, {
        name: "idx_users_email",
        type: "normal",
        parts: [{ type: "column", value: colId, order: "ASC" }],
        filter: ""
      });

      store.updateTable(tId, { name: "profiles" });

      // Index names ARE automatically updated when table is renamed
      expect(store.tables[0].indexes[0].name).toBe("idx_profiles_email");
    });

    it("preserves constraint expressions with complex syntax", () => {
      const store = useSchemaStore();
      store.addTable("orders");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;
      store.updateColumn(tId, colId, { name: "total_amount" });

      const complexExpr = "total_amount >= 0 AND total_amount <= 999999.99";
      store.tables[0].checkConstraints.push({
        id: "chk_1",
        name: "chk_amount_range",
        expression: complexExpr
      });

      store.updateColumn(tId, colId, { name: "final_amount" });

      expect(store.tables[0].checkConstraints[0].expression)
        .toBe("final_amount >= 0 AND final_amount <= 999999.99");
    });
  });

  describe("Index edge cases", () => {
    it("handles empty index parts gracefully", () => {
      const store = useSchemaStore();
      store.addTable("test");
      const tId = store.tables[0].id;

      store.addIndex(tId, {
        name: "idx_empty",
        type: "normal",
        parts: [],
        filter: ""
      });

      expect(store.tables[0].indexes[0].parts).toHaveLength(0);
    });

    it("removes indexes when table is deleted", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;

      store.addIndex(tId, {
        name: "idx_users",
        type: "normal",
        parts: [{ type: "column", value: colId, order: "ASC" }],
        filter: ""
      });

      expect(store.tables[0].indexes).toHaveLength(1);

      store.removeTable(tId);
      expect(store.tables).toHaveLength(0);
    });

    it("handles indexes with columns that reference other columns", () => {
      const store = useSchemaStore();
      store.addTable("items");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      store.addColumn(tId);
      const col1Id = store.tables[0].columns[0].id;
      const col2Id = store.tables[0].columns[1].id;
      store.updateColumn(tId, col1Id, { name: "category" });
      store.updateColumn(tId, col2Id, { name: "price" });

      // Composite index
      store.addIndex(tId, {
        name: "idx_items_cat_price",
        type: "normal",
        parts: [
          { type: "column", value: col1Id, order: "ASC" },
          { type: "column", value: col2Id, order: "DESC" }
        ],
        filter: "price > 0"
      });

      // Rename first column
      store.updateColumn(tId, col1Id, { name: "item_category" });

      // Index should be updated
      expect(store.tables[0].indexes[0].name).toBe("idx_items_item_category_price");
    });
  });
});
