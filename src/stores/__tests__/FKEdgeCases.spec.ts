import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../schemaStore";

describe("Foreign Key Edge Cases", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("Multiple FKs", () => {
    it("handles multiple FKs on the same column", () => {
      const store = useSchemaStore();

      // Create 3 tables
      store.addTable("users");
      store.addTable("posts");
      store.addTable("comments");
      const uId = store.tables[0].id;
      const pId = store.tables[1].id;
      const cId = store.tables[2].id;

      // Add columns
      [uId, pId, cId].forEach(tid => store.addColumn(tid));
      const uColId = store.tables[0].columns[0].id;
      const pColId = store.tables[1].columns[0].id;
      const cColId = store.tables[2].columns[0].id;

      // Add multiple FKs pointing to the same column
      store.addForeignKey({
        sourceTableId: pId,
        sourceColumnId: pColId,
        targetTableId: uId,
        targetColumnId: uColId,
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      });

      store.addForeignKey({
        sourceTableId: cId,
        sourceColumnId: cColId,
        targetTableId: uId,
        targetColumnId: uColId,
        onDelete: "SET NULL",
        onUpdate: "CASCADE"
      });

      expect(store.foreignKeys).toHaveLength(2);
      expect(store.foreignKeys[0].onDelete).toBe("CASCADE");
      expect(store.foreignKeys[1].onDelete).toBe("SET NULL");
    });

    it("handles FKs between multiple columns in same table pair", () => {
      const store = useSchemaStore();

      store.addTable("employees");
      store.addTable("departments");
      const eId = store.tables[0].id;
      const dId = store.tables[1].id;

      // Add multiple columns to each table
      store.addColumn(eId);
      store.addColumn(eId);
      store.addColumn(dId);
      store.addColumn(dId);

      const e1 = store.tables[0].columns[0].id;
      const e2 = store.tables[0].columns[1].id;
      const d1 = store.tables[1].columns[0].id;
      const d2 = store.tables[1].columns[1].id;

      // Create FKs on both column pairs
      store.addForeignKey({
        sourceTableId: eId,
        sourceColumnId: e1,
        targetTableId: dId,
        targetColumnId: d1,
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      });

      store.addForeignKey({
        sourceTableId: eId,
        sourceColumnId: e2,
        targetTableId: dId,
        targetColumnId: d2,
        onDelete: "RESTRICT",
        onUpdate: "CASCADE"
      });

      expect(store.foreignKeys).toHaveLength(2);
      expect(store.foreignKeys[0].onDelete).toBe("CASCADE");
      expect(store.foreignKeys[1].onDelete).toBe("RESTRICT");
    });
  });

  describe("Self-referencing FKs", () => {
    it("allows self-referencing foreign keys", () => {
      const store = useSchemaStore();

      store.addTable("categories");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      store.addColumn(tId);
      const idCol = store.tables[0].columns[0].id;
      const parentCol = store.tables[0].columns[1].id;

      store.addForeignKey({
        sourceTableId: tId,
        sourceColumnId: parentCol,
        targetTableId: tId,
        targetColumnId: idCol,
        onDelete: "SET NULL",
        onUpdate: "CASCADE"
      });

      expect(store.foreignKeys).toHaveLength(1);
      expect(store.foreignKeys[0].sourceTableId).toBe(tId);
      expect(store.foreignKeys[0].targetTableId).toBe(tId);
    });

    it("handles cascading deletion of self-referencing tables", () => {
      const store = useSchemaStore();

      store.addTable("categories");
      const tId = store.tables[0].id;
      store.addColumn(tId);
      store.addColumn(tId);
      const idCol = store.tables[0].columns[0].id;
      const parentCol = store.tables[0].columns[1].id;

      store.addForeignKey({
        sourceTableId: tId,
        sourceColumnId: parentCol,
        targetTableId: tId,
        targetColumnId: idCol,
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      });

      expect(store.foreignKeys).toHaveLength(1);

      store.removeTable(tId);
      expect(store.foreignKeys).toHaveLength(0);
    });
  });

  describe("FK with complex dependencies", () => {
    it("maintains FKs during complex column operations", () => {
      const store = useSchemaStore();

      store.addTable("users");
      store.addTable("posts");
      const uId = store.tables[0].id;
      const pId = store.tables[1].id;

      store.addColumn(uId);
      store.addColumn(pId);
      const uColId = store.tables[0].columns[0].id;
      const pColId = store.tables[1].columns[0].id;

      store.updateColumn(uId, uColId, { isPrimaryKey: true });
      store.updateColumn(pId, pColId, { name: "author_id" });

      store.addForeignKey({
        sourceTableId: pId,
        sourceColumnId: pColId,
        targetTableId: uId,
        targetColumnId: uColId,
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      });

      expect(store.foreignKeys[0].targetColumnId).toBe(uColId);

      // Reorder columns in posts table
      store.addColumn(pId);
      store.reorderColumns(pId, 0, 1);

      // FK should still be valid
      expect(store.foreignKeys[0].sourceColumnId).toBe(pColId);
    });

    it("updates FKs when source column type changes", () => {
      const store = useSchemaStore();

      store.addTable("users");
      store.addTable("posts");
      const uId = store.tables[0].id;
      const pId = store.tables[1].id;

      store.addColumn(uId);
      store.addColumn(pId);
      const uColId = store.tables[0].columns[0].id;
      const pColId = store.tables[1].columns[0].id;

      store.updateColumn(uId, uColId, { isPrimaryKey: true, type: "uuid" });
      store.updateColumn(pId, pColId, { type: "uuid" });

      store.addForeignKey({
        sourceTableId: pId,
        sourceColumnId: pColId,
        targetTableId: uId,
        targetColumnId: uColId,
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      });

      // Change source column type
      store.updateColumn(pId, pColId, { type: "bigint" });

      // FK should still exist but source column type changed
      expect(store.foreignKeys[0].sourceColumnId).toBe(pColId);
      expect(store.tables[1].columns[0].type).toBe("bigint");
    });
  });

  describe("FK actions", () => {
    it("allows all ON DELETE actions", () => {
      const store = useSchemaStore();

      store.addTable("users");
      store.addTable("posts");
      const uId = store.tables[0].id;
      const pId = store.tables[1].id;

      store.addColumn(uId);
      store.addColumn(pId);
      const uColId = store.tables[0].columns[0].id;
      const pColId = store.tables[1].columns[0].id;

      const actions = ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"] as const;

      actions.forEach((action) => {
        store.addForeignKey({
          sourceTableId: pId,
          sourceColumnId: pColId,
          targetTableId: uId,
          targetColumnId: uColId,
          onDelete: action,
          onUpdate: "CASCADE"
        });
      });

      expect(store.foreignKeys).toHaveLength(4);
      store.foreignKeys.forEach((fk, i) => {
        expect(fk.onDelete).toBe(actions[i]);
      });
    });

    it("updates FK actions correctly", () => {
      const store = useSchemaStore();

      store.addTable("users");
      store.addTable("posts");
      const uId = store.tables[0].id;
      const pId = store.tables[1].id;

      store.addColumn(uId);
      store.addColumn(pId);
      const uColId = store.tables[0].columns[0].id;
      const pColId = store.tables[1].columns[0].id;

      store.addForeignKey({
        sourceTableId: pId,
        sourceColumnId: pColId,
        targetTableId: uId,
        targetColumnId: uColId,
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      });

      const fkId = store.foreignKeys[0].id;
      store.updateForeignKey(fkId, { onDelete: "SET NULL", onUpdate: "RESTRICT" });

      expect(store.foreignKeys[0].onDelete).toBe("SET NULL");
      expect(store.foreignKeys[0].onUpdate).toBe("RESTRICT");
    });
  });

  describe("FK deletion safety", () => {
    it("preserves FKs when non-target table is deleted", () => {
      const store = useSchemaStore();

      store.addTable("users");
      store.addTable("posts");
      store.addTable("comments");
      const uId = store.tables[0].id;
      const pId = store.tables[1].id;
      const cId = store.tables[2].id;

      [uId, pId, cId].forEach(tid => store.addColumn(tid));
      const uColId = store.tables[0].columns[0].id;
      const pColId = store.tables[1].columns[0].id;
      const cColId = store.tables[2].columns[0].id;

      // FK from posts to users
      store.addForeignKey({
        sourceTableId: pId,
        sourceColumnId: pColId,
        targetTableId: uId,
        targetColumnId: uColId,
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      });

      expect(store.foreignKeys).toHaveLength(1);

      // Delete comments (unrelated table)
      store.removeTable(cId);

      // FK should still exist
      expect(store.foreignKeys).toHaveLength(1);
    });

    it("removes only FKs pointing to deleted table", () => {
      const store = useSchemaStore();

      store.addTable("users");
      store.addTable("posts");
      store.addTable("comments");
      const uId = store.tables[0].id;
      const pId = store.tables[1].id;
      const cId = store.tables[2].id;

      [uId, pId, cId].forEach(tid => store.addColumn(tid));
      const uColId = store.tables[0].columns[0].id;
      const pColId = store.tables[1].columns[0].id;
      const cColId = store.tables[2].columns[0].id;

      // FK from posts to users
      store.addForeignKey({
        sourceTableId: pId,
        sourceColumnId: pColId,
        targetTableId: uId,
        targetColumnId: uColId,
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      });

      // FK from comments to posts
      store.addForeignKey({
        sourceTableId: cId,
        sourceColumnId: cColId,
        targetTableId: pId,
        targetColumnId: pColId,
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      });

      expect(store.foreignKeys).toHaveLength(2);

      // Delete users table
      store.removeTable(uId);

      // Only FK to users should be removed
      expect(store.foreignKeys).toHaveLength(1);
      expect(store.foreignKeys[0].targetTableId).toBe(pId);
    });
  });
});
