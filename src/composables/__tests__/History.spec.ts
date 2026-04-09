import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../../stores/schemaStore";
import { useHistory } from "../useHistory";
import { nextTick } from "vue";

describe("useHistory (Undo/Redo)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it("captures changes and allows undo/redo", async () => {
    const store = useSchemaStore();
    const history = useHistory();

    // Initial state
    expect(history.canUndo.value).toBe(false);

    // 1. Perform action: Add Table
    store.addTable("users");
    await nextTick();
    
    // Fast-forward debounce timer
    vi.advanceTimersByTime(300);
    expect(history.canUndo.value).toBe(true);
    expect(store.tables).toHaveLength(1);

    // 2. Perform another action: Update Table Name
    const tableId = store.tables[0].id;
    store.updateTable(tableId, { name: "profiles" });
    await nextTick();
    vi.advanceTimersByTime(300);
    expect(store.tables[0].name).toBe("profiles");

    // 3. Undo: Name should go back to "users"
    history.undo();
    vi.runAllTimers(); 
    expect(store.tables[0].name).toBe("users");
    expect(history.canRedo.value).toBe(true);

    // 4. Redo: Name should go back to "profiles"
    history.redo();
    vi.runAllTimers();
    expect(store.tables[0].name).toBe("profiles");

    // 5. Undo again, then perform new action -> Redo stack should clear
    history.undo();
    vi.runAllTimers();
    expect(history.canRedo.value).toBe(true);
    
    store.addTable("posts");
    await nextTick();
    vi.advanceTimersByTime(300);
    expect(history.canRedo.value).toBe(false);
  });

  it("performs atomic undo for complex side effects (column rename)", async () => {
    const store = useSchemaStore();
    const history = useHistory();

    // Setup: Table with index and constraint using a column
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    const colId = store.tables[0].columns[0].id;
    store.updateColumn(tId, colId, { name: "email" });

    store.addIndex(tId, {
      name: "idx_users_email",
      type: "normal",
      parts: [{ type: "column", value: colId }]
    });

    store.tables[0].checkConstraints.push({
      id: "c1",
      name: "chk_users_email",
      expression: "email LIKE '%@%'"
    });

    // Advance to baseline
    await nextTick();
    vi.advanceTimersByTime(300);
    history.clearHistory(); // Start fresh

    // ACTION: Rename column (this triggers multiple side effects in one tick)
    store.updateColumn(tId, colId, { name: "email_address" });
    
    await nextTick();
    vi.advanceTimersByTime(300);

    // Verify side effects occurred
    expect(store.tables[0].columns[0].name).toBe("email_address");
    expect(store.tables[0].indexes[0].name).toBe("idx_users_email_address");
    expect(store.tables[0].checkConstraints[0].name).toBe("chk_users_email_addressli");

    // UNDO: Should revert everything atomically
    history.undo();
    vi.runAllTimers();

    expect(store.tables[0].columns[0].name).toBe("email");
    expect(store.tables[0].indexes[0].name).toBe("idx_users_email");
    expect(store.tables[0].checkConstraints[0].name).toBe("chk_users_email");
  });

  it("clears history and prevents undoing past a fresh baseline", async () => {
    const store = useSchemaStore();
    const history = useHistory();

    store.addTable("users");
    await nextTick();
    vi.advanceTimersByTime(300);
    expect(history.canUndo.value).toBe(true);

    // ACTION: clearHistory (simulating hydration baseline)
    history.clearHistory();
    
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
    
    // Attempting undo should do nothing
    history.undo();
    expect(store.tables).toHaveLength(1);
  });
});
