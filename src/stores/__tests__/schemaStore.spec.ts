import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../schemaStore";

describe("schemaStore CRUD & Side Effects", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("Table CRUD", () => {
    it("creates and deletes a table", () => {
      const store = useSchemaStore();
      store.addTable("users");
      expect(store.tables).toHaveLength(1);
      expect(store.tables[0].name).toBe("users");

      const tableId = store.tables[0].id;
      store.removeTable(tableId);
      expect(store.tables).toHaveLength(0);
    });

    it("updates table properties", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tableId = store.tables[0].id;

      store.updateTable(tableId, { name: "profiles", notes: "User profiles" });
      expect(store.tables[0].name).toBe("profiles");
      expect(store.tables[0].notes).toBe("User profiles");
    });
  });

  describe("Column CRUD & Logic", () => {
    it("adds, updates and removes columns", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tableId = store.tables[0].id;

      store.addColumn(tableId);
      expect(store.tables[0].columns).toHaveLength(1);
      const colId = store.tables[0].columns[0].id;

      store.updateColumn(tableId, colId, { name: "email", type: "text" });
      expect(store.tables[0].columns[0].name).toBe("email");

      store.removeColumn(tableId, colId);
      expect(store.tables[0].columns).toHaveLength(0);
    });

    it("reorders columns correctly", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tId = store.tables[0].id;

      store.addColumn(tId); // col 1
      store.addColumn(tId); // col 2
      const firstId = store.tables[0].columns[0].id;

      store.reorderColumns(tId, 0, 1);
      expect(store.tables[0].columns[1].id).toBe(firstId);
    });

    it("enforces single primary key logic", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tId = store.tables[0].id;

      store.addColumn(tId); // col 1
      store.addColumn(tId); // col 2
      const id1 = store.tables[0].columns[0].id;
      const id2 = store.tables[0].columns[1].id;

      store.updateColumn(tId, id1, { isPrimaryKey: true });
      expect(store.tables[0].columns[0].isPrimaryKey).toBe(true);

      store.updateColumn(tId, id2, { isPrimaryKey: true });
      expect(store.tables[0].columns[0].isPrimaryKey).toBe(false);
      expect(store.tables[0].columns[1].isPrimaryKey).toBe(true);
    });
  });

  describe("Foreign Key Side Effects", () => {
    it("cascades table deletion to foreign keys", () => {
      const store = useSchemaStore();
      store.addTable("users");
      store.addTable("posts");
      const uId = store.tables[0].id;
      const pId = store.tables[1].id;

      store.addColumn(uId);
      store.addColumn(pId);

      store.addForeignKey({
        sourceTableId: pId,
        sourceColumnId: store.tables[1].columns[0].id,
        targetTableId: uId,
        targetColumnId: store.tables[0].columns[0].id,
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      expect(store.foreignKeys).toHaveLength(1);

      // Remove the target table
      store.removeTable(uId);
      // FK should be gone
      expect(store.foreignKeys).toHaveLength(0);
    });

    it("automatically updates FK target when target table PK is changed", () => {
      const store = useSchemaStore();
      
      // Target Table (Users)
      store.addTable("users");
      const uId = store.tables[0].id;
      store.addColumn(uId); // Col 1 (current PK)
      store.addColumn(uId); // Col 2 (new PK later)
      const uC1 = store.tables[0].columns[0].id;
      const uC2 = store.tables[0].columns[1].id;
      store.updateColumn(uId, uC1, { isPrimaryKey: true });

      // Source Table (Orders)
      store.addTable("orders");
      const oId = store.tables[1].id;
      store.addColumn(oId);
      const oC1 = store.tables[1].columns[0].id;

      // Add FK pointing to Users.Col1
      store.addForeignKey({
        sourceTableId: oId,
        sourceColumnId: oC1,
        targetTableId: uId,
        targetColumnId: uC1,
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      expect(store.foreignKeys[0].targetColumnId).toBe(uC1);

      // Change PK from Col 1 to Col 2
      store.updateColumn(uId, uC2, { isPrimaryKey: true });

      // The FK should now point to Col 2
      expect(store.foreignKeys[0].targetColumnId).toBe(uC2);
    });

    it("automatically refactors index expressions and constraints when a column is renamed", () => {
      const store = useSchemaStore();
      store.addTable("users");
      const tId = store.tables[0].id;
      
      store.addColumn(tId);
      const colId = store.tables[0].columns[0].id;
      store.updateColumn(tId, colId, { name: "email" });

      // Add Index with Column Part
      store.addIndex(tId, {
        name: "idx_users_email",
        type: "normal",
        parts: [{ type: "column", value: colId, order: "ASC" }],
        filter: ""
      });

      // Add Check constraint
      store.tables[0].checkConstraints.push({
        id: "c1",
        name: "chk_email",
        expression: "email LIKE '%@%'"
      });

      // Rename column: email -> email_address
      store.updateColumn(tId, colId, { name: "email_address" });

      // Index name, parts, and constraints should be updated
      expect(store.tables[0].indexes[0].name).toBe("idx_users_email_address"); 
      expect(store.tables[0].checkConstraints[0].expression).toBe("email_address LIKE '%@%'");
    });
  });

  describe("Atomic Integrity & Collisions", () => {
    it("automatically resolves duplicate table names", () => {
      const store = useSchemaStore();
      store.addTable("users");
      store.addTable("users");
      
      expect(store.tables).toHaveLength(2);
      expect(store.tables[0].name).toBe("users");
      expect(store.tables[1].name).toBe("users_1");
    });

    it("automatically resolves duplicate column names in same table", () => {
      const store = useSchemaStore();
      store.addTable("tests");
      const tId = store.tables[0].id;
      
      store.addColumn(tId); // new_column
      store.addColumn(tId); // new_column_1
      
      expect(store.tables[0].columns[0].name).toBe("new_column");
      expect(store.tables[0].columns[1].name).toBe("new_column_1");
    });

    it("prevents renaming a column to an existing column name", () => {
      const store = useSchemaStore();
      store.addTable("tests");
      const tId = store.tables[0].id;
      
      store.addColumn(tId); // col1
      store.addColumn(tId); // col2
      const col2Id = store.tables[0].columns[1].id;
      
      store.updateColumn(tId, col2Id, { name: "new_column" }); // collision with col 1
      expect(store.tables[0].columns[1].name).toBe("new_column_1");
    });
  });

  describe("View Mode (Role Access Simulator)", () => {
    it("persists viewMode state", () => {
      const store = useSchemaStore();
      expect(store.viewMode).toBe("full");
      store.viewMode = "read";
      expect(store.viewMode).toBe("read");
    });
  });
});
