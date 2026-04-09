import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../schemaStore";
import { useHistory } from "../../composables/useHistory";
import { nextTick } from "vue";

describe("Cross-Table Integrity & Global Undo", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it("restores multiple foreign keys from different tables when a deleted table is undone", async () => {
    const store = useSchemaStore();
    const history = useHistory();

    // 1. Setup: Users (A), Posts (B), Comments (C)
    store.addTable("users");
    const uId = store.tables[0].id;
    store.addColumn(uId);
    const uPkId = store.tables[0].columns[0].id;
    store.updateColumn(uId, uPkId, { name: "id", isPrimaryKey: true });

    store.addTable("posts");
    const pId = store.tables[1].id;
    store.addColumn(pId);
    const pAuthorId = store.tables[1].columns[0].id;
    store.updateColumn(pId, pAuthorId, { name: "author_id" });

    store.addTable("comments");
    const cId = store.tables[2].id;
    store.addColumn(cId);
    const cAuthorId = store.tables[2].columns[0].id;
    store.updateColumn(cId, cAuthorId, { name: "user_id" });

    // 2. Add FKs: Posts -> Users, Comments -> Users
    store.addForeignKey({
      sourceTableId: pId, sourceColumnId: pAuthorId,
      targetTableId: uId, targetColumnId: uPkId,
      onDelete: "CASCADE", onUpdate: "CASCADE"
    });
    store.addForeignKey({
      sourceTableId: cId, sourceColumnId: cAuthorId,
      targetTableId: uId, targetColumnId: uPkId,
      onDelete: "CASCADE", onUpdate: "CASCADE"
    });

    await nextTick();
    vi.advanceTimersByTime(300);
    history.clearHistory(); // Baseline with 3 tables and 2 FKs

    expect(store.tables).toHaveLength(3);
    expect(store.foreignKeys).toHaveLength(2);

    // 3. ACTION: Delete the Target Table (Users)
    store.removeTable(uId);
    
    await nextTick();
    vi.advanceTimersByTime(300);
    
    expect(store.tables).toHaveLength(2);
    expect(store.foreignKeys).toHaveLength(0); // Cascade removed both FKs

    // 4. UNDO: Restore Users table
    history.undo();
    vi.runAllTimers();

    // 5. VERIFY: Everything is back
    expect(store.tables).toHaveLength(3);
    expect(store.tables.find(t => t.id === uId)).toBeDefined();
    expect(store.foreignKeys).toHaveLength(2);
    expect(store.foreignKeys[0].targetTableId).toBe(uId);
    expect(store.foreignKeys[1].targetTableId).toBe(uId);
  });

  it("handles self-referencing foreign keys correctly during column deletion", () => {
    const store = useSchemaStore();
    
    // Setup: Employee Table with 'manager_id' referencing 'id'
    store.addTable("employees");
    const tId = store.tables[0].id;
    
    store.addColumn(tId); // id
    const pkId = store.tables[0].columns[0].id;
    store.updateColumn(tId, pkId, { name: "id", isPrimaryKey: true });
    
    store.addColumn(tId); // manager_id
    const managerId = store.tables[0].columns[1].id;
    store.updateColumn(tId, managerId, { name: "manager_id" });

    store.addForeignKey({
      sourceTableId: tId, sourceColumnId: managerId,
      targetTableId: tId, targetColumnId: pkId,
      onDelete: "SET NULL", onUpdate: "CASCADE"
    });

    expect(store.foreignKeys).toHaveLength(1);

    // ACTION: Delete the PK column (id)
    store.removeColumn(tId, pkId);

    // VERIFY: The self-referencing FK should be removed safely
    expect(store.foreignKeys).toHaveLength(0);
  });
});
