import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SqlExportModal from "../SqlExportModal.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("SqlExportModal.vue (Output Verification)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Mock URL.createObjectURL for download logic
    window.URL.createObjectURL = vi.fn();
    window.URL.revokeObjectURL = vi.fn();
  });

  it("generates SQL with named constraints and table notes", async () => {
    const store = useSchemaStore();
    
    // Setup complex table
    store.addTable("order_items");
    const tId = store.tables[0].id;
    store.updateTable(tId, { notes: "Stores items for each order" });
    
    // Add columns
    store.addColumn(tId); // id
    store.addColumn(tId); // order_id
    store.addColumn(tId); // product_id
    
    const colIds = store.tables[0].columns.map(c => c.id);
    store.updateColumn(tId, colIds[0], { name: "order_id", isPrimaryKey: false, type: "int" });
    store.updateColumn(tId, colIds[1], { name: "product_id", isPrimaryKey: true, type: "int" });
    store.updateColumn(tId, colIds[2], { 
      name: "quantity", 
      isPrimaryKey: false, 
      type: "int", 
      defaultValue: "1",
      isNullable: false 
    });

    // Add named constraint
    store.tables[0].checkConstraints.push({
      id: "c1",
      name: "chk_min_qty",
      expression: "quantity > 0"
    });

    const wrapper = mount(SqlExportModal, {
      props: { isOpen: true },
      global: {
        stubs: {
          Teleport: true
        }
      }
    });

    const sql = (wrapper.find("textarea").element as HTMLTextAreaElement).value;

    // Check Table Notes
    expect(sql).toContain("-- Stores items for each order");
    
    // Check PK
    expect(sql).toContain("PRIMARY KEY (product_id)");
    
    // Check Columns & Defaults (isNullable: false -> NOT NULL)
    expect(sql).toContain("quantity int NOT NULL DEFAULT 1");

    // Check Named Constraint
    expect(sql).toContain("CONSTRAINT chk_min_qty CHECK (quantity > 0)");
  });

  it("generates SQL with complex indexes", async () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    const colId = store.tables[0].columns[0].id;
    store.updateColumn(tId, colId, { name: "email" });

    store.addIndex(tId, {
      name: "idx_unique_email",
      type: "unique",
      parts: [
        { type: "column", value: colId, order: "ASC" },
        { type: "expression", value: "lower(email)", order: "ASC" }
      ],
      filter: "deleted_at IS NULL"
    });

    const wrapper = mount(SqlExportModal, {
      props: { isOpen: true },
      global: {
        stubs: {
          Teleport: true
        }
      }
    });

    const sql = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
    
    expect(sql).toContain("CREATE UNIQUE INDEX idx_unique_email ON users (email, lower(email)) WHERE deleted_at IS NULL");
  });

  it("generates SQL for foreign Keys", async () => {
    const store = useSchemaStore();
    
    // Table A: Sites
    store.addTable("sites");
    const sId = store.tables[0].id;
    store.addColumn(sId);
    const sC1 = store.tables[0].columns[0].id; 

    // Table B: Users
    store.addTable("users");
    const uId = store.tables[1].id;
    store.addColumn(uId);
    const uC1 = store.tables[1].columns[0].id; 

    store.addForeignKey({
      sourceTableId: uId,
      sourceColumnId: uC1,
      targetTableId: sId,
      targetColumnId: sC1,
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    });

    const wrapper = mount(SqlExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } }
    });

    const sql = (wrapper.find("textarea").element as HTMLTextAreaElement).value;

    expect(sql).toContain("ALTER TABLE users");
    expect(sql).toContain("FOREIGN KEY (new_column) REFERENCES sites (new_column)");
  });
});
