import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../schemaStore";

describe("Data Integrity Side Effects", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("cleans up indexes when a column is removed", () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    
    store.addColumn(tId);
    const colId = store.tables[0].columns[0].id;

    // Add index on that column
    store.addIndex(tId, {
      name: "idx_user_col",
      type: "normal",
      parts: [{ type: "column", value: colId, order: "ASC" }],
      filter: ""
    });

    expect(store.tables[0].indexes).toHaveLength(1);

    // Remove the column
    store.removeColumn(tId, colId);

    // Index should be removed because it became empty
    expect(store.tables[0].indexes).toHaveLength(0);
  });

  it("removes the entire index if any participant column is removed", () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    const colId = store.tables[0].columns[0].id;

    store.addIndex(tId, {
      name: "idx_composite",
      type: "normal",
      parts: [
        { type: "column", value: colId, order: "ASC" },
        { type: "expression", value: "lower(username)", order: "ASC" }
      ],
      filter: ""
    });

    store.removeColumn(tId, colId);

    // Index should be entirely removed because one of its participant columns was deleted
    expect(store.tables[0].indexes).toHaveLength(0);
  });

  it("removes index if a column name used in an expression is deleted", () => {
    const store = useSchemaStore();
    store.addTable("products");
    const tId = store.tables[0].id;
    
    store.addColumn(tId);
    const colId = store.tables[0].columns[0].id;
    store.updateColumn(tId, colId, { name: "price" });

    // Index with expression using 'price'
    store.addIndex(tId, {
      name: "idx_expr",
      type: "normal",
      parts: [
        { type: "expression", value: "price * 1.1", order: "ASC" }
      ],
      filter: ""
    });

    expect(store.tables[0].indexes).toHaveLength(1);

    // Remove the 'price' column
    store.removeColumn(tId, colId);

    // Index should be removed because 'price' is a dependency
    expect(store.tables[0].indexes).toHaveLength(0);
  });

  it("removes the entire Foreign Key if any participant column is removed", () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.addTable("profiles");
    const uId = store.tables[0].id;
    const pId = store.tables[1].id;

    store.addColumn(uId);
    const uC1 = store.tables[0].columns[0].id;

    store.addColumn(pId);
    const pC1 = store.tables[1].columns[0].id;

    store.addForeignKey({
      sourceTableId: pId,
      sourceColumnId: pC1,
      targetTableId: uId,
      targetColumnId: uC1,
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    });

    expect(store.foreignKeys).toHaveLength(1);

    // Remove the target column
    store.removeColumn(uId, uC1);

    // The entire FK should be removed
    expect(store.foreignKeys).toHaveLength(0);
  });
});
