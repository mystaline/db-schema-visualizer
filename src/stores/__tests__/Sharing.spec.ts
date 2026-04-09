import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSchemaStore } from "../schemaStore";

describe("Sharing & Serialization", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("round-trips data through base64 compression", async () => {
    // Check if CompressionStream is available in this environment
    if (typeof CompressionStream === 'undefined') {
       console.warn('CompressionStream not available in this environment, skipping serialization test.');
       return;
    }

    const store = useSchemaStore();
    store.addTable("users");
    store.addColumn(store.tables[0].id);
    
    // Generate shareable string
    const base64 = await store.getShareableData('read');
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);

    // Clear store
    store.tables = [];
    store.viewMode = 'full';

    // Hydrate
    await store.loadFromShareableData(base64);
    
    expect(store.tables).toHaveLength(1);
    expect(store.tables[0].name).toBe("users");
    expect(store.viewMode).toBe("read");
  });
});
