import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../schemaStore";

describe("LocalStorage Persistence", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Clear localStorage mock
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("saves state to localStorage on changes", async () => {
    const store = useSchemaStore();
    
    // Simulate change
    store.addTable("users");
    
    // Wait for the watcher to fire (watchers are async)
    await new Promise(r => setTimeout(r, 0));

    const saved = localStorage.getItem("db_schema_visualizer");
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.t[0].name).toBe("users");
  });

  it("loads state from localStorage correctly", () => {
    const store = useSchemaStore();
    
    const mockData = {
      t: [{ id: "t1", name: "persisted_table", x: 0, y: 0, columns: [], indexes: [], checkConstraints: [] }],
      f: [],
      v: { x: 10, y: 10, k: 1.5 },
      s: "t1"
    };
    
    localStorage.setItem("db_schema_visualizer", JSON.stringify(mockData));
    
    const success = store.loadFromLocalStorage();
    expect(success).toBe(true);
    expect(store.tables).toHaveLength(1);
    expect(store.tables[0].name).toBe("persisted_table");
    expect(store.canvasTransform.k).toBe(1.5);
    expect(store.selectedTableId).toBe("t1");
  });
});
