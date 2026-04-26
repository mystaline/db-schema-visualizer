import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";
import { parseDDL } from "../utils/ddlParser";
import { uuid } from "../utils/uuid";

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
  // Legacy format support
  columnIds?: string[];
  expressions?: string[];
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

    const id = uuid();
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
        id: uuid(),
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
      id: uuid(),
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
        id: uuid(),
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
          indexes: (table.indexes || []).map((idx: TableIndex) => {
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
          indexes: (table.indexes || []).map((idx: TableIndex) => {
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

  const loadPreset = (type: "blog" | "ecommerce") => {
    tables.value = [];
    foreignKeys.value = [];

    if (type === "blog") {
      const userId = uuid();
      const postId = uuid();
      const commentId = uuid();
      const tagId = uuid();
      const userPkId = uuid();
      const postPkId = uuid();
      const tagPkId = uuid();

      tables.value.push({ id: userId, name: "profiles", x: 50, y: 50, columns: [
        { id: userPkId, name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: "gen_random_uuid()" },
        { id: uuid(), name: "username", type: "varchar(50)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
        { id: uuid(), name: "display_name", type: "text", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
        { id: uuid(), name: "email", type: "varchar(255)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
        { id: uuid(), name: "meta", type: "jsonb", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: "'{}'::jsonb" },
      ], indexes: [{ id: uuid(), name: "idx_profiles_email", type: "unique", parts: [{ type: "column", value: "email", order: "ASC" }], filter: "" }], checkConstraints: [] });

      tables.value.push({ id: postId, name: "articles", x: 450, y: 50, columns: [
        { id: postPkId, name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: "gen_random_uuid()" },
        { id: uuid(), name: "author_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: uuid(), name: "slug", type: "varchar(200)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
        { id: uuid(), name: "title", type: "text", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: uuid(), name: "body", type: "text", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: uuid(), name: "view_count", type: "int", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "0" },
        { id: uuid(), name: "published_at", type: "timestamptz", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ], indexes: [{ id: uuid(), name: "idx_articles_slug", type: "unique", parts: [{ type: "column", value: "slug", order: "ASC" }], filter: "" }], checkConstraints: [{ id: uuid(), name: "chk_view_count_pos", expression: "view_count >= 0" }] });

      tables.value.push({ id: tagId, name: "tags", x: 450, y: 500, columns: [
        { id: tagPkId, name: "id", type: "int", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: uuid(), name: "name", type: "varchar(50)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
      ], indexes: [], checkConstraints: [] });

      const bridgeId = uuid();
      tables.value.push({ id: bridgeId, name: "article_tags", x: 800, y: 350, columns: [
        { id: uuid(), name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: "gen_random_uuid()" },
        { id: uuid(), name: "article_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: uuid(), name: "tag_id", type: "int", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ], indexes: [], checkConstraints: [] });

      const commentAuthorId = uuid();
      const commentPostId = uuid();
      tables.value.push({ id: commentId, name: "comments", x: 800, y: 50, columns: [
        { id: uuid(), name: "id", type: "bigint", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: commentAuthorId, name: "user_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: commentPostId, name: "article_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: uuid(), name: "content", type: "text", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: uuid(), name: "is_flagged", type: "boolean", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "false" },
      ], indexes: [], checkConstraints: [] });

      const authorCol = tables.value.find((t) => t.id === postId)!.columns.find((c) => c.name === "author_id")!;
      addForeignKey({ sourceTableId: postId, sourceColumnId: authorCol.id, targetTableId: userId, targetColumnId: userPkId, onDelete: "CASCADE", onUpdate: "CASCADE" });
      addForeignKey({ sourceTableId: commentId, sourceColumnId: commentAuthorId, targetTableId: userId, targetColumnId: userPkId, onDelete: "CASCADE", onUpdate: "CASCADE" });
      addForeignKey({ sourceTableId: commentId, sourceColumnId: commentPostId, targetTableId: postId, targetColumnId: postPkId, onDelete: "CASCADE", onUpdate: "CASCADE" });
      const bridgeCols = tables.value.find((t) => t.id === bridgeId)!.columns;
      addForeignKey({ sourceTableId: bridgeId, sourceColumnId: bridgeCols[1].id, targetTableId: postId, targetColumnId: postPkId, onDelete: "CASCADE", onUpdate: "CASCADE" });
      addForeignKey({ sourceTableId: bridgeId, sourceColumnId: bridgeCols[2].id, targetTableId: tagId, targetColumnId: tagPkId, onDelete: "CASCADE", onUpdate: "CASCADE" });
    }

    if (type === "ecommerce") {
      const customerId = uuid();
      const customerPkId = uuid();
      const orderId = uuid();
      const orderCustomerId = uuid();
      const productId = uuid();
      const productPkId = uuid();
      const itemId = uuid();
      const categoryId = uuid();
      const categoryPkId = uuid();

      tables.value.push({ id: customerId, name: "customers", x: 50, y: 50, columns: [
        { id: customerPkId, name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: "gen_random_uuid()" },
        { id: uuid(), name: "email", type: "varchar(255)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
        { id: uuid(), name: "first_name", type: "text", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
        { id: uuid(), name: "last_name", type: "text", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
        { id: uuid(), name: "marketing_opt_in", type: "boolean", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "true" },
      ], indexes: [], checkConstraints: [] });

      tables.value.push({ id: categoryId, name: "categories", x: 50, y: 500, columns: [
        { id: categoryPkId, name: "id", type: "int", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: uuid(), name: "name", type: "varchar(100)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
        { id: uuid(), name: "parent_id", type: "int", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ], indexes: [], checkConstraints: [] });

      const productCategoryId = uuid();
      tables.value.push({ id: productId, name: "products", x: 450, y: 450, columns: [
        { id: productPkId, name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: "gen_random_uuid()" },
        { id: productCategoryId, name: "category_id", type: "int", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
        { id: uuid(), name: "sku", type: "varchar(20)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
        { id: uuid(), name: "price", type: "numeric(12,2)", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "0.00" },
        { id: uuid(), name: "specs", type: "jsonb", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ], indexes: [], checkConstraints: [{ id: uuid(), name: "chk_price_positive", expression: "price > 0" }] });

      tables.value.push({ id: orderId, name: "orders", x: 450, y: 50, columns: [
        { id: uuid(), name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: "gen_random_uuid()" },
        { id: orderCustomerId, name: "customer_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: uuid(), name: "order_date", type: "timestamptz", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "now()" },
        { id: uuid(), name: "total_amount", type: "numeric(12,2)", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "0" },
      ], indexes: [], checkConstraints: [] });

      const itemOrderId = uuid();
      const itemProductId = uuid();
      tables.value.push({ id: itemId, name: "order_line_items", x: 850, y: 250, columns: [
        { id: uuid(), name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: "gen_random_uuid()" },
        { id: itemOrderId, name: "order_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: itemProductId, name: "product_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: uuid(), name: "quantity", type: "int", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "1" },
        { id: uuid(), name: "unit_price", type: "numeric(12,2)", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ], indexes: [], checkConstraints: [{ id: uuid(), name: "chk_qty_pos", expression: "quantity > 0" }] });

      addForeignKey({ sourceTableId: orderId, sourceColumnId: orderCustomerId, targetTableId: customerId, targetColumnId: customerPkId, onDelete: "RESTRICT", onUpdate: "CASCADE" });
      const lineItemCols = tables.value.find((t) => t.id === itemId)!.columns;
      addForeignKey({ sourceTableId: itemId, sourceColumnId: lineItemCols[1].id, targetTableId: orderId, targetColumnId: tables.value.find((t) => t.id === orderId)!.columns[0].id, onDelete: "CASCADE", onUpdate: "CASCADE" });
      addForeignKey({ sourceTableId: itemId, sourceColumnId: lineItemCols[2].id, targetTableId: productId, targetColumnId: productPkId, onDelete: "CASCADE", onUpdate: "CASCADE" });
      addForeignKey({ sourceTableId: productId, sourceColumnId: productCategoryId, targetTableId: categoryId, targetColumnId: categoryPkId, onDelete: "SET NULL", onUpdate: "CASCADE" });
      addForeignKey({ sourceTableId: categoryId, sourceColumnId: tables.value.find((t) => t.id === categoryId)!.columns[2].id, targetTableId: categoryId, targetColumnId: categoryPkId, onDelete: "CASCADE", onUpdate: "CASCADE" });

      const orders = tables.value.find((t) => t.name === "orders");
      if (orders) {
        const custIdCol = orders.columns.find((c) => c.name === "customer_id");
        const dateCol = orders.columns.find((c) => c.name === "order_date");
        if (custIdCol && dateCol) {
          orders.indexes.push({ id: uuid(), name: "idx_orders_customer_date", type: "normal", parts: [{ type: "column", value: custIdCol.id, order: "ASC" }, { type: "column", value: dateCol.id, order: "DESC" }], filter: "" });
        }
      }
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
    loadPreset,
    getShareableData,
    loadFromShareableData,
    loadFromLocalStorage,
    importFromSql: async (ddl: string) => {
      const { tables: newTables, foreignKeys: newFKs } = parseDDL(ddl);

      // Simple grid layout
      const COLS = Math.ceil(Math.sqrt(newTables.length || 1));
      const X_GAP = 300;
      const Y_GAP = 400;

      newTables.forEach((table, i) => {
        table.x = (i % COLS) * X_GAP + 100;
        table.y = Math.floor(i / COLS) * Y_GAP + 100;
      });

      tables.value = newTables;
      foreignKeys.value = newFKs;
      selectedTableId.value = null;
      canvasTransform.value = { x: 0, y: 0, k: 1 };
    },

    importFromJson: async (jsonStr: string) => {
      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed.tables)) {
        throw new Error('Invalid JSON schema: missing "tables" array');
      }

      const newTables: Table[] = (parsed.tables as Table[]).map((table) => ({
        ...table,
        indexes: (table.indexes || []).map((idx: TableIndex) => {
          if (idx.columnIds && !idx.parts) {
            return {
              ...idx,
              parts: [
                ...idx.columnIds.map((id: string) => ({
                  type: "column" as const,
                  value: id,
                  order: "ASC" as const,
                })),
              ],
            };
          }
          return idx;
        }),
        checkConstraints: table.checkConstraints || [],
      }));

      const newFKs: ForeignKey[] = Array.isArray(parsed.foreignKeys)
        ? parsed.foreignKeys
        : [];

      tables.value = newTables;
      foreignKeys.value = newFKs;
      selectedTableId.value = null;
      canvasTransform.value = { x: 0, y: 0, k: 1 };
    },
  };
});
