import type { Table, TableIndex } from "../stores/schemaStore";

/**
 * Builds a standardized index name (idx_/unq_<table>_<col1>_<col2>...).
 * Pure — shared by schemaStore's interactive index editor and migrationFold's
 * ADD CONSTRAINT ... UNIQUE handler.
 */
export function getIndexName(
  table: Table,
  index: Omit<TableIndex, "id" | "name">,
): string {
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
}

/**
 * Builds a standardized CHECK constraint name (chk_<table>_<snippet>).
 * Pure — shared by schemaStore's interactive constraint editor and
 * migrationFold's ADD CONSTRAINT ... CHECK handler.
 */
export function getConstraintName(table: Table, expression: string): string {
  const snippet = expression
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 15)
    .toLowerCase();
  return `chk_${table.name}_${snippet}`;
}
