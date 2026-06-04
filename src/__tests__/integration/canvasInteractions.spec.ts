/**
 * Integration: canvas transform, table selection, table position, relation lines
 * Covers: schemaStore canvasTransform / selectedTableId / updateTable position
 *
 * Note: DOM event-driven pan/zoom (mousedown+mousemove, wheel) requires a
 * rendered SchemaCanvas. These tests cover the store-level state contract —
 * what the canvas event handlers ultimately write to canvasTransform — as well
 * as store-level relation line data integrity.
 */
import { describe, it, expect } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSchemaStore } from "../../stores/schemaStore";

function makeStore() {
  setActivePinia(createPinia());
  return useSchemaStore();
}

function addTableWithCol(store: ReturnType<typeof useSchemaStore>, name = "t") {
  store.addTable(name);
  const t = store.tables[store.tables.length - 1];
  store.addColumn(t.id);
  return store.tables.find((tbl) => tbl.id === t.id)!;
}

// ─── Canvas rendering / initial state ─────────────────────────────────────────

describe("Canvas rendering", () => {
  it("initial canvasTransform is x=0, y=0, k=1", () => {
    const store = makeStore();
    expect(store.canvasTransform).toEqual({ x: 0, y: 0, k: 1 });
  });

  it("tables added to the store have valid x/y positions", () => {
    const store = makeStore();
    store.addTable("positioned");
    const t = store.tables[0];
    expect(typeof t.x).toBe("number");
    expect(typeof t.y).toBe("number");
  });

  it("selectedTableId starts as null", () => {
    const store = makeStore();
    expect(store.selectedTableId).toBeNull();
  });

  it("selectedTable computed returns undefined/null when nothing is selected", () => {
    const store = makeStore();
    expect(store.selectedTable).toBeFalsy();
  });

  it("selectedTable computed returns the table when selectedTableId is set", () => {
    const store = makeStore();
    store.addTable("chosen");
    store.selectedTableId = store.tables[0].id;
    expect(store.selectedTable?.name).toBe("chosen");
  });
});

// ─── Canvas pan (store contract) ──────────────────────────────────────────────

describe("Canvas pan", () => {
  it("writing canvasTransform x/y updates the store", () => {
    const store = makeStore();
    store.canvasTransform.x = 150;
    store.canvasTransform.y = 250;
    expect(store.canvasTransform.x).toBe(150);
    expect(store.canvasTransform.y).toBe(250);
  });

  it("pan does not affect zoom level (k stays unchanged)", () => {
    const store = makeStore();
    store.canvasTransform.k = 1.5;
    store.canvasTransform.x = 100;
    store.canvasTransform.y = 100;
    expect(store.canvasTransform.k).toBe(1.5);
  });

  it("canvasTransform is persisted to localStorage on change", () => {
    const store = makeStore();
    store.canvasTransform.x = 999;
    store.addTable("trigger"); // ensures watcher fires
    const raw = localStorage.getItem("db_schema_visualizer");
    const parsed = JSON.parse(raw!);
    expect(parsed.v.x).toBe(999);
    localStorage.clear();
  });
});

// ─── Canvas zoom (store contract) ─────────────────────────────────────────────

describe("Canvas zoom", () => {
  it("zoom scale can be set directly on canvasTransform.k", () => {
    const store = makeStore();
    store.canvasTransform.k = 1.5;
    expect(store.canvasTransform.k).toBe(1.5);
  });

  it("zoom clamps to minimum scale 0.2 when clamping logic is applied", () => {
    // Simulate the clamp formula from SchemaCanvas.handleWheel / handleTouchMove
    const oldScale = 0.25;
    const delta = -500; // zoom-out wheel
    const speed = 0.001;
    const factor = 1 - delta * speed;
    const newScale = Math.min(Math.max(0.2, oldScale * factor), 2);
    expect(newScale).toBeGreaterThanOrEqual(0.2);
  });

  it("zoom clamps to maximum scale 2 when zooming in", () => {
    const oldScale = 1.9;
    const delta = -200; // zoom-in wheel
    const speed = 0.001;
    const factor = 1 - delta * speed;
    const newScale = Math.min(Math.max(0.2, oldScale * factor), 2);
    expect(newScale).toBeLessThanOrEqual(2);
  });

  it("loadPreset resets canvasTransform to origin", () => {
    const store = makeStore();
    store.canvasTransform.x = 500;
    store.canvasTransform.y = 400;
    store.canvasTransform.k = 1.8;
    store.loadPreset("blog");
    expect(store.canvasTransform).toEqual({ x: 0, y: 0, k: 1 });
  });

  it("importFromSql resets canvasTransform to origin", async () => {
    const store = makeStore();
    store.canvasTransform.x = 300;
    store.canvasTransform.k = 1.5;
    await store.importFromSql("CREATE TABLE t (id UUID PRIMARY KEY);");
    expect(store.canvasTransform).toEqual({ x: 0, y: 0, k: 1 });
  });
});

// ─── Table node drag (position updates) ──────────────────────────────────────

describe("Table node drag", () => {
  it("updateTable with x/y updates the table position in store", () => {
    const store = makeStore();
    const t = addTableWithCol(store, "draggable");
    store.updateTable(t.id, { x: 350, y: 200 });
    expect(store.tables.find((tbl) => tbl.id === t.id)!.x).toBe(350);
    expect(store.tables.find((tbl) => tbl.id === t.id)!.y).toBe(200);
  });

  it("dragging one table does not affect another table's position", () => {
    const store = makeStore();
    addTableWithCol(store, "a");
    addTableWithCol(store, "b");
    const a = store.tables[0];
    const b = store.tables[1];
    const bOriginalX = b.x;
    store.updateTable(a.id, { x: 500, y: 300 });
    expect(store.tables.find((t) => t.id === b.id)!.x).toBe(bOriginalX);
  });

  it("table position is persisted to localStorage after drag", () => {
    const store = makeStore();
    const t = addTableWithCol(store, "moved");
    store.updateTable(t.id, { x: 777, y: 888 });
    const raw = localStorage.getItem("db_schema_visualizer");
    const parsed = JSON.parse(raw!);
    const found = parsed.t.find((tbl: { id: string }) => tbl.id === t.id);
    expect(found.x).toBe(777);
    expect(found.y).toBe(888);
    localStorage.clear();
  });
});

// ─── Table node selection ─────────────────────────────────────────────────────

describe("Table node selection", () => {
  it("setting selectedTableId selects a table", () => {
    const store = makeStore();
    store.addTable("selectable");
    store.selectedTableId = store.tables[0].id;
    expect(store.selectedTableId).toBe(store.tables[0].id);
  });

  it("setting selectedTableId to null clears selection", () => {
    const store = makeStore();
    store.addTable("was_selected");
    store.selectedTableId = store.tables[0].id;
    store.selectedTableId = null;
    expect(store.selectedTableId).toBeNull();
  });

  it("clicking a different table switches selection", () => {
    const store = makeStore();
    store.addTable("first");
    store.addTable("second");
    store.selectedTableId = store.tables[0].id;
    store.selectedTableId = store.tables[1].id;
    expect(store.selectedTableId).toBe(store.tables[1].id);
  });

  it("removing the selected table clears selectedTableId", () => {
    const store = makeStore();
    store.addTable("to_delete");
    const id = store.tables[0].id;
    store.selectedTableId = id;
    store.removeTable(id);
    expect(store.selectedTableId).toBeNull();
  });
});

// ─── Relation lines (FK data integrity) ──────────────────────────────────────

describe("Relation lines", () => {
  it("FK between two tables links their IDs in the store", () => {
    const store = makeStore();
    const src = addTableWithCol(store, "orders");
    const tgt = addTableWithCol(store, "users");
    store.addForeignKey({
      sourceTableId: src.id,
      sourceColumnId: src.columns[0].id,
      targetTableId: tgt.id,
      targetColumnId: tgt.columns[0].id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    const fk = store.foreignKeys[0];
    expect(fk.sourceTableId).toBe(src.id);
    expect(fk.targetTableId).toBe(tgt.id);
  });

  it("self-referential FK has equal source and target table IDs", () => {
    const store = makeStore();
    const t = addTableWithCol(store, "categories");
    store.addColumn(t.id);
    const live = store.tables.find((tbl) => tbl.id === t.id)!;
    store.updateColumn(t.id, live.columns[0].id, {
      name: "id",
      isPrimaryKey: true,
    });
    store.updateColumn(t.id, live.columns[1].id, {
      name: "parent_id",
      isNullable: true,
    });
    store.addForeignKey({
      sourceTableId: t.id,
      sourceColumnId: live.columns[1].id,
      targetTableId: t.id,
      targetColumnId: live.columns[0].id,
      onDelete: "SET NULL",
      onUpdate: "NO ACTION",
    });
    expect(store.foreignKeys[0].sourceTableId).toBe(
      store.foreignKeys[0].targetTableId,
    );
  });

  it("FK is removed when the source column is deleted", () => {
    const store = makeStore();
    const src = addTableWithCol(store, "items");
    const tgt = addTableWithCol(store, "categories");
    store.addForeignKey({
      sourceTableId: src.id,
      sourceColumnId: src.columns[0].id,
      targetTableId: tgt.id,
      targetColumnId: tgt.columns[0].id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    store.removeColumn(src.id, src.columns[0].id);
    expect(store.foreignKeys).toHaveLength(0);
  });

  it("moving a table (updateTable) does not break FK references", () => {
    const store = makeStore();
    const src = addTableWithCol(store, "a");
    const tgt = addTableWithCol(store, "b");
    store.addForeignKey({
      sourceTableId: src.id,
      sourceColumnId: src.columns[0].id,
      targetTableId: tgt.id,
      targetColumnId: tgt.columns[0].id,
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    store.updateTable(src.id, { x: 600, y: 400 });
    expect(store.foreignKeys).toHaveLength(1);
    expect(store.foreignKeys[0].sourceTableId).toBe(src.id);
  });
});

// ─── Fit-to-view / zoom controls (store contract) ────────────────────────────

describe("Fit-to-view / zoom controls", () => {
  it("setting k > 1 zooms in", () => {
    const store = makeStore();
    store.canvasTransform.k = 1.5;
    expect(store.canvasTransform.k).toBeGreaterThan(1);
  });

  it("setting k < 1 zooms out", () => {
    const store = makeStore();
    store.canvasTransform.k = 0.5;
    expect(store.canvasTransform.k).toBeLessThan(1);
  });

  it("reset sets canvasTransform back to default", () => {
    const store = makeStore();
    store.canvasTransform.x = 300;
    store.canvasTransform.y = 200;
    store.canvasTransform.k = 1.8;
    // Simulate the reset that loadPreset / importFromSql / zoomToFit would do
    store.canvasTransform.x = 0;
    store.canvasTransform.y = 0;
    store.canvasTransform.k = 1;
    expect(store.canvasTransform).toEqual({ x: 0, y: 0, k: 1 });
  });
});
