import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";

export interface Column {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue: string | null;
}

export interface IndexPart {
  type: "column" | "expression";
  value: string; // columnId if type is 'column', raw expression string otherwise
  order?: "ASC" | "DESC"; // Usually for columns, but Postgres supports it for expressions too
}

export interface TableIndex {
  id: string;
  name: string;
  type: "normal" | "unique";
  parts: IndexPart[];
  filter?: string;
}

export interface CheckConstraint {
  id: string;
  name: string;
  expression: string;
}

export interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  columns: Column[];
  indexes: TableIndex[];
  checkConstraints: CheckConstraint[];
  notes?: string;
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

export type ViewMode = "full" | "read";

const getUniqueName = (base: string, others: string[]) => {
  let name = base;
  let counter = 1;
  while (others.includes(name)) {
    name = `${base}_${counter}`;
    counter++;
  }
  return name;
};

export const useSchemaStore = defineStore("schema", () => {
  const tables = ref<Table[]>([]);
  const foreignKeys = ref<ForeignKey[]>([]);
  const selectedTableId = ref<string | null>(null);
  const activeDrag = ref<{ id: string; x: number; y: number } | null>(null);
  const canvasTransform = ref({ x: 0, y: 0, k: 1 });
  const viewMode = ref<ViewMode>("full");

  const selectedTable = computed(() =>
    tables.value.find((t) => t.id === selectedTableId.value),
  );

  // Helper to generate a standardized index name
  const getIndexName = (
    table: Table,
    index: Omit<TableIndex, "id" | "name">,
  ) => {
    const names = index.parts
      .map((p) => {
        if (p.type === "column") {
          return table.columns.find((col) => col.id === p.value)?.name;
        }
        return p.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 10);
      })
      .filter(Boolean);

    const prefix = index.type === "unique" ? "unq" : "idx";
    return `${prefix}_${table.name}_${names.join("_")}`;
  };

  const getConstraintName = (table: Table, expression: string) => {
    const snippet = expression
      .replace(/[^a-zA-Z0-9_]/g, "")
      .slice(0, 15)
      .toLowerCase();
    return `chk_${table.name}_${snippet}`;
  };

  const addTable = (name: string = "new_table") => {
    const existingNames = tables.value.map((t) => t.name);
    const uniqueName = getUniqueName(name, existingNames);

    const id = crypto.randomUUID();
    tables.value.push({
      id,
      name: uniqueName,
      x: 100,
      y: 100,
      columns: [],
      indexes: [],
      checkConstraints: [],
    });
    selectedTableId.value = id;
  };

  const addColumn = (tableId: string) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (table) {
      const existingColNames = table.columns.map((c) => c.name);
      const uniqueName = getUniqueName("new_column", existingColNames);

      table.columns.push({
        id: crypto.randomUUID(),
        name: uniqueName,
        type: "varchar",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      });
    }
  };

  const updateColumn = (
    tableId: string,
    columnId: string,
    updates: Partial<Column>,
  ) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (table) {
      const columnIndex = table.columns.findIndex((c) => c.id === columnId);
      if (columnIndex === -1) return;

      if (updates.name && updates.name !== table.columns[columnIndex].name) {
        const oldName = table.columns[columnIndex].name;
        const otherNames = table.columns
          .filter((c) => c.id !== columnId)
          .map((c) => c.name);
        updates.name = getUniqueName(updates.name, otherNames);
        const newName = updates.name;

        // SIDE EFFECT: Re-refactor expressions and REBUILD index names
        const wordRegex = new RegExp(`\\b${oldName}\\b`, "gi");

        table.indexes.forEach((idx) => {
          // 1. Update expression values first
          idx.parts.forEach((part) => {
            if (part.type === "expression") {
              part.value = part.value.replace(wordRegex, newName);
            }
          });

          // 2. Then rebuild name based on NEW values
          // We temp update the column name in the array so getIndexName sees it
          const originalName = table.columns[columnIndex].name;
          table.columns[columnIndex].name = newName;
          idx.name = getIndexName(table, idx);
          table.columns[columnIndex].name = originalName;
        });

        table.checkConstraints.forEach((chk) => {
          chk.expression = chk.expression.replace(wordRegex, newName);
          chk.name = getConstraintName(table, chk.expression);
        });
      }

      table.columns[columnIndex] = {
        ...table.columns[columnIndex],
        ...updates,
      };

      if (table.columns[columnIndex].isPrimaryKey) {
        const oldPkColumn = table.columns.find(
          (c) => c.isPrimaryKey && c.id !== columnId,
        );
        table.columns.forEach((c) => {
          if (c.id !== columnId) c.isPrimaryKey = false;
        });
        table.columns[columnIndex].isNullable = false;

        if (oldPkColumn) {
          foreignKeys.value.forEach((fk) => {
            if (
              fk.targetTableId === tableId &&
              fk.targetColumnId === oldPkColumn.id
            ) {
              fk.targetColumnId = columnId;
            }
          });
        }
      }
    }
  };

  const removeColumn = (tableId: string, columnId: string) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (!table) return;

    const column = table.columns.find((c) => c.id === columnId);
    const columnName = column?.name;

    table.columns = table.columns.filter((c) => c.id !== columnId);

    foreignKeys.value = foreignKeys.value.filter(
      (fk) => fk.sourceColumnId !== columnId && fk.targetColumnId !== columnId,
    );

    table.indexes = table.indexes.filter((idx) => {
      const usesColumn = idx.parts.some((part) => {
        if (part.type === "column") return part.value === columnId;
        if (part.type === "expression" && columnName) {
          const regex = new RegExp(`\\b${columnName}\\b`, "i");
          return regex.test(part.value);
        }
        return false;
      });
      return !usesColumn;
    });

    table.checkConstraints = table.checkConstraints.filter((chk) => {
      if (!columnName) return true;
      const regex = new RegExp(`\\b${columnName}\\b`, "i");
      return !regex.test(chk.expression);
    });
  };

  const updateTable = (id: string, updates: Partial<Table>) => {
    const table = tables.value.find((t) => t.id === id);
    if (table) {
      if (updates.name && updates.name !== table.name) {
        const otherNames = tables.value
          .filter((t) => t.id !== id)
          .map((t) => t.name);
        updates.name = getUniqueName(updates.name, otherNames);
        const newTableName = updates.name;

        // SIDE EFFECT: Rebuild all index names because table name changed
        const originalTableName = table.name;
        table.name = newTableName;
        table.indexes.forEach((idx) => {
          idx.name = getIndexName(table, idx);
        });
        table.checkConstraints.forEach((chk) => {
          chk.name = getConstraintName(table, chk.expression);
        });
        table.name = originalTableName;
      }
      Object.assign(table, updates);
    }
  };

  const removeTable = (id: string) => {
    tables.value = tables.value.filter((t) => t.id !== id);
    foreignKeys.value = foreignKeys.value.filter(
      (fk) => fk.sourceTableId !== id && fk.targetTableId !== id,
    );
    if (selectedTableId.value === id) {
      selectedTableId.value = null;
    }
  };

  const addForeignKey = (fk: Omit<ForeignKey, "id">) => {
    foreignKeys.value.push({
      ...fk,
      id: crypto.randomUUID(),
    });
  };

  const updateForeignKey = (id: string, updates: Partial<ForeignKey>) => {
    const index = foreignKeys.value.findIndex((fk) => fk.id === id);
    if (index !== -1) {
      foreignKeys.value[index] = { ...foreignKeys.value[index], ...updates };
    }
  };

  const removeForeignKey = (id: string) => {
    foreignKeys.value = foreignKeys.value.filter((fk) => fk.id !== id);
  };

  const addIndex = (tableId: string, indexData: Omit<TableIndex, "id">) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (table) {
      const index: TableIndex = {
        id: crypto.randomUUID(),
        ...indexData,
      };
      table.indexes.push(index);
    }
  };

  const removeIndex = (tableId: string, indexId: string) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (table) {
      table.indexes = table.indexes.filter((i) => i.id !== indexId);
    }
  };

  const reorderColumns = (
    tableId: string,
    oldIndex: number,
    newIndex: number,
  ) => {
    const table = tables.value.find((t) => t.id === tableId);
    if (!table) return;
    const cols = [...table.columns];
    const [moved] = cols.splice(oldIndex, 1);
    cols.splice(newIndex, 0, moved);
    table.columns = cols;
  };

  // --- LOCALSTORAGE ---
  const saveToLocalStorage = () => {
    const data = {
      t: tables.value,
      f: foreignKeys.value,
      v: canvasTransform.value,
      s: selectedTableId.value,
    };
    localStorage.setItem("db_schema_visualizer", JSON.stringify(data));
  };

  const loadFromLocalStorage = () => {
    try {
      const raw = localStorage.getItem("db_schema_visualizer");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed.t) {
        tables.value = parsed.t.map((table: Table) => ({
          ...table,
          indexes: (table.indexes || []).map((idx: any) => {
            if (idx.columnIds && !idx.parts) {
              return {
                ...idx,
                parts: [
                  ...idx.columnIds.map((id: string) => ({
                    type: "column",
                    value: id,
                    order: "ASC",
                  })),
                  ...(idx.expressions || []).map((expr: string) => ({
                    type: "expression",
                    value: expr,
                    order: "ASC",
                  })),
                ],
              };
            }
            return idx;
          }),
        }));
      }
      if (parsed.f) foreignKeys.value = parsed.f;
      if (parsed.v) {
        canvasTransform.value = {
          x: parsed.v.x ?? 0,
          y: parsed.v.y ?? 0,
          k: parsed.v.k ?? parsed.v.scale ?? 1,
        };
      }
      if (parsed.s) selectedTableId.value = parsed.s;
      return true;
    } catch {
      return false;
    }
  };

  watch(
    [tables, foreignKeys, canvasTransform, selectedTableId, viewMode],
    saveToLocalStorage,
    { deep: true },
  );

  // URL Sharing Logic (URL-Safe Base64)
  const getShareableData = async (permission: ViewMode = "full") => {
    const data = JSON.stringify({
      t: tables.value,
      f: foreignKeys.value,
      v: canvasTransform.value,
      s: selectedTableId.value,
      p: permission,
    });

    const stream = new Blob([data])
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    const compressedBuf = await new Response(stream).arrayBuffer();
    const bytes = new Uint8Array(compressedBuf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++)
      binary += String.fromCharCode(bytes[i]);

    // URL-safe Base64: replace + with -, / with _, and strip padding
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  const loadFromShareableData = async (base64: string) => {
    try {
      // Revert URL-safe chars back to standard Base64
      let standardB64 = base64.replace(/-/g, "+").replace(/_/g, "/");
      while (standardB64.length % 4 !== 0) standardB64 += "=";

      const compressedBuf = Uint8Array.from(atob(standardB64), (c) =>
        c.charCodeAt(0),
      );
      const stream = new Blob([compressedBuf])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
      const decompressedData = await new Response(stream).text();
      const parsed = JSON.parse(decompressedData);

      viewMode.value = parsed.p === "read" ? "read" : "full";
      if (parsed.t) {
        tables.value = parsed.t.map((table: Table) => ({
          ...table,
          indexes: (table.indexes || []).map((idx: any) => {
            if (idx.columnIds && !idx.parts) {
              return {
                ...idx,
                parts: [
                  ...idx.columnIds.map((id: string) => ({
                    type: "column",
                    value: id,
                    order: "ASC",
                  })),
                  ...(idx.expressions || []).map((expr: string) => ({
                    type: "expression",
                    value: expr,
                    order: "ASC",
                  })),
                ],
              };
            }
            return idx;
          }),
        }));
      }
      if (parsed.f) foreignKeys.value = parsed.f;
      if (parsed.v) {
        canvasTransform.value = {
          x: parsed.v.x ?? 0,
          y: parsed.v.y ?? 0,
          k: parsed.v.k ?? parsed.v.scale ?? 1,
        };
      }
      if (parsed.s) selectedTableId.value = parsed.s;
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
    getIndexName,
    getConstraintName,
    reorderColumns,
    removeIndex,
    getShareableData,
    loadFromShareableData,
    loadFromLocalStorage,
  };
});
