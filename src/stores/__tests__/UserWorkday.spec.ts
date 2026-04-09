import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../schemaStore";
import { useHistory } from "../../composables/useHistory";
import { nextTick } from "vue";

describe("User Workday E2E Simulation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it("survives a complex sequence of user actions and side effects", async () => {
    const store = useSchemaStore();
    const history = useHistory();

    // --- 1. LOAD TEMPLATE (Manually simulate Blog Preset) ---
    store.addTable("users");
    const uId = store.tables[0].id;
    store.addColumn(uId);
    const uPkId = store.tables[0].columns[0].id;
    store.updateColumn(uId, uPkId, { name: "id", isPrimaryKey: true });
    
    await nextTick(); vi.advanceTimersByTime(300);
    history.clearHistory(); // BASELINE

    // --- 2. ADD NEW TABLE & COLUMNS ---
    store.addTable("notifications");
    const nId = store.tables[1].id;
    store.addColumn(nId); // col1
    store.addColumn(nId); // col2
    const nCol1 = store.tables[1].columns[0].id; // recipient_id (later)
    const nCol2 = store.tables[1].columns[1].id; // message
    
    store.updateColumn(nId, nCol1, { name: "user_id" });
    store.updateColumn(nId, nCol2, { name: "message" });

    // --- 3. REFACTORING (Rename triggered side effects) ---
    // Add index first
    store.addIndex(nId, {
      name: "idx_notif_user",
      type: "normal",
      parts: [{ type: "column", value: nCol1 }]
    });
    
    // Rename user_id -> recipient_id
    store.updateColumn(nId, nCol1, { name: "recipient_id" });
    expect(store.tables[1].indexes[0].name).toBe("idx_notifications_recipient_id");

    // --- 4. ESTABLISH RELATIONSHIP ---
    store.addForeignKey({
      sourceTableId: nId, sourceColumnId: nCol1,
      targetTableId: uId, targetColumnId: uPkId,
      onDelete: "CASCADE", onUpdate: "CASCADE"
    });
    expect(store.foreignKeys).toHaveLength(1);

    // WAIT: Let the history watcher commit the 'notifications setup' state
    await nextTick();
    vi.advanceTimersByTime(300);

    // --- 5. CHAOS: DELETE USERS ---
    store.removeTable(uId);
    expect(store.tables).toHaveLength(1); // Only notifications left
    expect(store.foreignKeys).toHaveLength(0); // FK gone

    // --- 6. UNDO (The most critical part) ---
    // We need to advance timers for each action to let watcher capture snapshots
    await nextTick(); vi.advanceTimersByTime(300);
    
    history.undo(); // Restore Users + FK
    vi.runAllTimers();
    expect(store.tables).toHaveLength(2);
    expect(store.foreignKeys).toHaveLength(1);
    expect(store.tables.find(t => t.name === "users")).toBeDefined();

    // --- 7. INDEXING & CONSTRAINTS ---
    // Add mixed index
    store.addIndex(nId, {
      name: "idx_complex",
      type: "normal",
      parts: [
        { type: "column", value: nCol1 },
        { type: "expression", value: "length(message)" }
      ]
    });
    
    // Add constraint
    store.tables[1].checkConstraints.push({
      id: "c1", name: "chk_notif_msg", expression: "length(message) > 0"
    });

    // --- 8. RE-ORDERING ---
    // Current: [recipient_id, message]
    // Action: Swap them
    store.reorderColumns(nId, 0, 1);
    expect(store.tables[1].columns[0].name).toBe("message");
    expect(store.tables[1].columns[1].name).toBe("recipient_id");

    // --- 9. FINAL SIDE EFFECT CHECK ---
    // Rename 'message' to 'body'
    store.updateColumn(nId, nCol2, { name: "body" });
    
    // Verify Index and Constraint rebuilds/updates
    expect(store.tables[1].indexes[1].parts[1].value).toBe("length(body)");
    expect(store.tables[1].indexes[1].name).toBe("idx_notifications_recipient_id_lengthbody");
    expect(store.tables[1].checkConstraints[0].expression).toBe("length(body) > 0");
    expect(store.tables[1].checkConstraints[0].name).toBe("chk_notifications_lengthbody0");

    // --- 10. CLEAN EXIT ---
    // Delete 'body' column
    store.removeColumn(nId, nCol2);
    // Index using 'body' should be gone, index using 'recipient_id' should stay
    expect(store.tables[1].indexes).toHaveLength(1);
    expect(store.tables[1].indexes[0].name).toBe("idx_notifications_recipient_id");
    expect(store.tables[1].checkConstraints).toHaveLength(0);
    
    // Final check for orphans
    expect(store.tables).toHaveLength(2);
    expect(store.foreignKeys).toHaveLength(1);
  });
});
