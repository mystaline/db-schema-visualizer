import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../schemaStore";

describe("Deep Integrity & Side Effects", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("cascades table deletion to ALL related foreign keys (source or target)", () => {
    const store = useSchemaStore();
    
    // Setup: Users (1) -> Products (n)
    store.addTable("users");
    const userId = store.tables[0].id;
    store.addColumn(userId);
    const userPkId = store.tables[0].columns[0].id;
    store.updateColumn(userId, userPkId, { name: "id", isPrimaryKey: true });

    store.addTable("products");
    const prodId = store.tables[1].id;
    store.addColumn(prodId);
    const prodOwnerId = store.tables[1].columns[0].id;
    store.updateColumn(prodId, prodOwnerId, { name: "user_id" });

    // Create FK
    store.addForeignKey({
      sourceTableId: prodId,
      sourceColumnId: prodOwnerId,
      targetTableId: userId,
      targetColumnId: userPkId,
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    });

    expect(store.foreignKeys).toHaveLength(1);

    // ACTION: Delete Target Table (Users)
    store.removeTable(userId);
    
    // VERIFY: FK should be gone
    expect(store.tables).toHaveLength(1);
    expect(store.tables[0].name).toBe("products");
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("removes index if a column used in its expression is deleted", () => {
    const store = useSchemaStore();
    store.addTable("products");
    const tId = store.tables[0].id;
    
    store.addColumn(tId);
    const col1Id = store.tables[0].columns[0].id;
    store.updateColumn(tId, col1Id, { name: "price" });

    // Create Index with expression using 'price'
    store.addIndex(tId, {
      name: "idx_complex",
      type: "normal",
      parts: [
        { type: "expression", value: "price * 1.1", order: "ASC" }
      ],
      filter: ""
    });

    expect(store.tables[0].indexes).toHaveLength(1);

    // ACTION: Delete the 'price' column
    store.removeColumn(tId, col1Id);

    // VERIFY: Index should be removed because the expression is no longer valid
    expect(store.tables[0].indexes).toHaveLength(0);
  });

  it("rebuilds index name when multiple columns in the same index are renamed", () => {
    const store = useSchemaStore();
    store.addTable("orders");
    const tId = store.tables[0].id;
    
    store.addColumn(tId); // col1
    store.addColumn(tId); // col2
    const c1Id = store.tables[0].columns[0].id;
    const c2Id = store.tables[0].columns[1].id;
    store.updateColumn(tId, c1Id, { name: "client" });
    store.updateColumn(tId, c2Id, { name: "date" });

    store.addIndex(tId, {
      name: "idx_orders_client_date",
      type: "normal",
      parts: [
        { type: "column", value: c1Id },
        { type: "column", value: c2Id }
      ]
    });

    // Rename first column
    store.updateColumn(tId, c1Id, { name: "customer" });
    expect(store.tables[0].indexes[0].name).toBe("idx_orders_customer_date");

    // Rename second column
    store.updateColumn(tId, c2Id, { name: "ordered_at" });
    expect(store.tables[0].indexes[0].name).toBe("idx_orders_customer_ordered_at");
  });
});
