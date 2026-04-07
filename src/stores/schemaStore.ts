import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";

const STORAGE_KEY = "db_schema_visualizer";

export type ViewMode = 'full' | 'read'

export interface Column {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue: string | null;
}

export interface Index {
  id: string;
  name: string;
  type: "unique" | "normal";
  columnIds: string[];
  filter: string;
}

export interface ForeignKey {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  onDelete: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  onUpdate: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}

export interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  columns: Column[];
  indexes: Index[];
  checkConstraints: string[];
  notes?: string;
}

export const useSchemaStore = defineStore("schema", () => {
  // State
  const tables = ref<Table[]>([]);
  const foreignKeys = ref<ForeignKey[]>([]);
  const selectedTableId = ref<string | null>(null);
  const activeDrag = ref<{ id: string, x: number, y: number } | null>(null);
  const canvasTransform = ref({ x: 0, y: 0, scale: 1 });
  const viewMode = ref<ViewMode>('full');

  // Getters
  const selectedTable = computed(
    () => tables.value.find((t) => t.id === selectedTableId.value) || null,
  );

  // Actions
  const addTable = (name: string) => {
    const id = crypto.randomUUID();
    tables.value.push({
      id,
      name,
      x: 100 + tables.value.length * 50,
      y: 100 + tables.value.length * 50,
      columns: [],
      indexes: [],
      checkConstraints: [],
    });
    selectedTableId.value = id;
  };

  const addColumn = (tableId: string) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (!table) return;

    const newColumn: Column = {
      id: crypto.randomUUID(),
      name: `column_${table.columns.length + 1}`,
      type: "varchar",
      isPrimaryKey: table.columns.length === 0,
      isNullable: table.columns.length === 0 ? false : true,
      isUnique: false,
      defaultValue: null,
    };
    table.columns.push(newColumn);
  };

  const updateColumn = (
    tableId: string,
    columnId: string,
    updates: Partial<Column>,
  ) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (!table) return;

    const columnIndex = table.columns.findIndex((c) => c.id === columnId);
    const prevPKIndex = table.columns.findIndex((c) => c.isPrimaryKey);
    if (columnIndex !== -1) {
      table.columns[columnIndex] = {
        ...table.columns[columnIndex],
        ...updates,
      };

      // Re-enforce PK invariants unconditionally after merge
      if (table.columns[columnIndex].isPrimaryKey) {
        table.columns[columnIndex].isNullable = false;

        if (prevPKIndex !== -1 && prevPKIndex !== columnIndex) {
          table.columns[prevPKIndex].isPrimaryKey = false;
        }
      }
    }
  };

  const removeColumn = (tableId: string, columnId: string) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (!table) return;

    table.columns = table.columns.filter((c) => c.id !== columnId);
    foreignKeys.value = foreignKeys.value.filter(
      (fk) => fk.sourceColumnId !== columnId && fk.targetColumnId !== columnId,
    );
  };

  const updateTable = (id: string, updates: Partial<Table>) => {
    const table = tables.value.find((t) => t.id === id);
    if (table) {
      Object.assign(table, updates);
    }
  };

  const removeTable = (id: string) => {
    tables.value = tables.value.filter((t) => t.id !== id);
    foreignKeys.value = foreignKeys.value.filter(
      (fk) => fk.sourceTableId !== id && fk.targetTableId !== id,
    );
    if (selectedTableId.value === id) selectedTableId.value = null;
  };

  const addForeignKey = (fk: Omit<ForeignKey, "id">) => {
    foreignKeys.value.push({ ...fk, id: crypto.randomUUID() });
  };

  const updateForeignKey = (id: string, updates: Partial<ForeignKey>) => {
    const index = foreignKeys.value.findIndex((f) => f.id === id);
    if (index !== -1) {
      foreignKeys.value[index] = { ...foreignKeys.value[index], ...updates };
    }
  };

  const removeForeignKey = (id: string) => {
    foreignKeys.value = foreignKeys.value.filter((f) => f.id !== id);
  };

  const addIndex = (tableId: string, index: Omit<Index, "id">) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (!table) return;
    table.indexes.push({ ...index, id: crypto.randomUUID() });
  };

  const removeIndex = (tableId: string, indexId: string) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (!table) return;
    table.indexes = table.indexes.filter((idx) => idx.id !== indexId);
  };

  // localStorage Persistence
  const saveToLocalStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        t: tables.value,
        f: foreignKeys.value,
        v: canvasTransform.value,
        s: selectedTableId.value,
      }));
    } catch { /* storage full or unavailable */ }
  };

  const loadFromLocalStorage = (): boolean => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed.t) tables.value = parsed.t;
      if (parsed.f) foreignKeys.value = parsed.f;
      if (parsed.v) canvasTransform.value = parsed.v;
      if (parsed.s) selectedTableId.value = parsed.s;
      return true;
    } catch {
      return false;
    }
  };

  watch([tables, foreignKeys, canvasTransform, selectedTableId], saveToLocalStorage, { deep: true });

  // URL Sharing Logic
  const getShareableData = async (permission: ViewMode = 'full') => {
    const data = JSON.stringify({
      t: tables.value,
      f: foreignKeys.value,
      v: canvasTransform.value,
      s: selectedTableId.value,
      p: permission,
    });

    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBuf = await new Response(stream).arrayBuffer();
    const bytes = new Uint8Array(compressedBuf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const loadFromShareableData = async (base64: string) => {
    try {
      const compressedBuf = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const stream = new Blob([compressedBuf]).stream().pipeThrough(new DecompressionStream('gzip'));
      const decompressedData = await new Response(stream).text();
      const parsed = JSON.parse(decompressedData);

      if (parsed.t) tables.value = parsed.t;
      if (parsed.f) foreignKeys.value = parsed.f;
      if (parsed.v) canvasTransform.value = parsed.v;
      if (parsed.s) selectedTableId.value = parsed.s;
      if (parsed.p === 'read') viewMode.value = 'read';
    } catch (e) {
      console.error("Failed to hydrate from URL data", e);
    }
  };

  return {
    tables,
    foreignKeys,
    selectedTableId,
    activeDrag,
    canvasTransform,
    viewMode,
    selectedTable,
    addTable,
    addColumn,
    updateColumn,
    removeColumn,
    updateTable,
    removeTable,
    addForeignKey,
    updateForeignKey,
    removeForeignKey,
    addIndex,
    removeIndex,
    getShareableData,
    loadFromShareableData,
    loadFromLocalStorage,
  };
});
