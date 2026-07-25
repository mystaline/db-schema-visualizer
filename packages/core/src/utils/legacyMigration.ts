import type { SchemaTable, TableIndex } from "../types";

/**
 * Migrates the legacy `TableIndex.columnIds`/`expressions` shape (pre-`parts`)
 * into the current `parts` array shape. Indexes that already have `parts`
 * are returned unchanged.
 */
export function migrateLegacyIndexes(indexes: TableIndex[] | undefined): TableIndex[] {
  return (indexes || []).map((idx) => {
    if (idx.columnIds && !idx.parts) {
      return {
        ...idx,
        parts: [
          ...idx.columnIds.map((id) => ({ type: "column" as const, value: id, order: "ASC" as const })),
          ...(idx.expressions || []).map((expr) => ({ type: "expression" as const, value: expr, order: "ASC" as const })),
        ],
      };
    }
    return idx;
  });
}

/**
 * Normalizes a single imported table: migrates legacy indexes and defaults
 * a missing checkConstraints array. Generic over T so callers whose table
 * type extends SchemaTable (e.g. the web app's Table, which adds x/y) keep
 * their extra fields.
 */
export function normalizeImportedTable<T extends SchemaTable>(table: T): T {
  return {
    ...table,
    indexes: migrateLegacyIndexes(table.indexes),
    checkConstraints: table.checkConstraints || [],
  };
}
