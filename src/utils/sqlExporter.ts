import type { Table, ForeignKey } from "../stores/schemaStore";

export interface BuildOptions {
  /** Set of table ids that are part of this export. */
  exportSet: Set<string>;
  /**
   * When true, foreign keys pointing to a target table NOT in `exportSet`
   * are still emitted but prefixed with a `-- WARNING: cross-boundary ...`
   * comment so consumers see the dangling reference.
   */
  markCrossBoundary: boolean;
}

/**
 * Builds the SQL for a single table: optional notes comments, CREATE TABLE
 * (columns + PRIMARY KEY + CHECK constraints), outgoing ALTER TABLE ADD
 * CONSTRAINT FK statements, and CREATE INDEX statements.
 *
 * `allTables` and `allForeignKeys` are full lists; filtering by `opts.exportSet`
 * happens inside.
 */
export function buildTableSql(
  table: Table,
  allTables: Table[],
  allForeignKeys: ForeignKey[],
  opts: BuildOptions,
): string {
  let sql = "";

  // Table notes as SQL comments
  if (table.notes?.trim()) {
    table.notes
      .trim()
      .split("\n")
      .forEach((line) => {
        sql += `-- ${line}\n`;
      });
  }

  sql += `CREATE TABLE ${table.name} (\n`;
  const lines: string[] = [];

  table.columns.forEach((col) => {
    let line = `  ${col.name} ${col.type}`;
    if (!col.isNullable) line += " NOT NULL";
    if (col.isUnique) line += " UNIQUE";
    if (col.defaultValue) line += ` DEFAULT ${col.defaultValue}`;
    lines.push(line);
  });

  const pks = table.columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
  if (pks.length > 0) {
    lines.push(`  PRIMARY KEY (${pks.join(", ")})`);
  }

  table.checkConstraints.forEach((constraint) => {
    lines.push(
      `  CONSTRAINT ${constraint.name} CHECK (${constraint.expression})`,
    );
  });

  sql += lines.join(",\n");
  sql += `\n);`;

  // Foreign Keys where this table is the source
  const tableFKs = allForeignKeys.filter(
    (fk) => fk.sourceTableId === table.id,
  );

  tableFKs.forEach((fk) => {
    const targetTable = allTables.find((t) => t.id === fk.targetTableId);
    if (!targetTable) return;

    const sourceCol = table.columns.find((c) => c.id === fk.sourceColumnId);
    const targetCol = targetTable.columns.find(
      (c) => c.id === fk.targetColumnId,
    );

    if (!sourceCol || !targetCol) {
      sql += `\n-- WARNING: foreign key between ${table.name} and ${targetTable.name} was skipped (column reference is broken)`;
      return;
    }

    const targetInSet = opts.exportSet.has(targetTable.id);
    if (!targetInSet && opts.markCrossBoundary) {
      sql += `\n\n-- WARNING: cross-boundary foreign key — references ${targetTable.name} not in this selection`;
    }
    sql += `\n\nALTER TABLE ${table.name}\n`;
    sql += `  ADD CONSTRAINT fk_${table.name}_${sourceCol.name}\n`;
    sql += `  FOREIGN KEY (${sourceCol.name}) REFERENCES ${targetTable.name} (${targetCol.name})\n`;
    sql += `  ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`;
  });

  // Indexes on this table
  table.indexes.forEach((idx) => {
    const parts: string[] = [];
    const brokenParts: string[] = [];

    (idx.parts ?? []).forEach((part) => {
      if (part.type === "column") {
        const column = table.columns.find((c) => c.id === part.value);
        if (column) {
          parts.push(part.order === "DESC" ? `${column.name} DESC` : column.name);
        } else {
          brokenParts.push(`column:${part.value}`);
        }
      } else {
        if (part.value.trim()) {
          parts.push(
            part.order === "DESC"
              ? `(${part.value.trim()}) DESC`
              : part.value.trim(),
          );
        } else {
          brokenParts.push("expression:empty");
        }
      }
    });

    if (parts.length > 0) {
      const uniqueStr = idx.type === "unique" ? " UNIQUE" : "";
      const whereStr = idx.filter ? ` WHERE ${idx.filter}` : "";
      if (brokenParts.length > 0) {
        sql += `\n-- WARNING: index ${idx.name} on ${table.name} has ${brokenParts.length} broken part(s): ${brokenParts.join(", ")}`;
      }
      sql += `\n\nCREATE${uniqueStr} INDEX ${idx.name} ON ${table.name} (${parts.join(", ")})${whereStr};`;
    } else if ((idx.parts ?? []).length > 0) {
      sql += `\n-- WARNING: index ${idx.name} on ${table.name} was skipped (all column/expression references are broken: ${brokenParts.join(", ")})`;
    }
  });

  return sql;
}

/**
 * Builds the full multi-table SQL document: header comment + each table's SQL
 * joined by a blank line. Only tables present in `opts.exportSet` are emitted.
 */
export function buildSchemaSql(
  tables: Table[],
  allForeignKeys: ForeignKey[],
  opts: BuildOptions,
): string {
  let header = `-- Database Schema SQL Export\n`;
  header += `-- Generated on ${new Date().toLocaleString()}\n\n`;
  const filtered = tables.filter((t) => opts.exportSet.has(t.id));
  const body = filtered
    .map((t) => buildTableSql(t, tables, allForeignKeys, opts))
    .join("\n\n");
  return header + body;
}

/**
 * Counts foreign keys whose source table is in `exportSet` but whose target
 * table is NOT in `exportSet`. Broken FKs (target table deleted) are excluded
 * from the count since they are covered by `hasBrokenRefs`. Used to drive
 * the cross-boundary warning banner.
 */
export function countCrossBoundaryFks(
  exportSet: Set<string>,
  allForeignKeys: ForeignKey[],
  allTables: Table[],
): number {
  return allForeignKeys.filter((fk) => {
    if (!exportSet.has(fk.sourceTableId)) return false;
    // Verify target table exists before counting as cross-boundary
    const targetExists = allTables.some((t) => t.id === fk.targetTableId);
    if (!targetExists) return false;
    return !exportSet.has(fk.targetTableId);
  }).length;
}

/**
 * Returns true if any foreign key or index in `tables`/`allForeignKeys`
 * references a column or table that no longer exists. Mirrors the existing
 * `hasBrokenExport` logic from ExportModal.vue so the component no longer
 * computes it inline.
 */
export function hasBrokenRefs(
  tables: Table[],
  allForeignKeys: ForeignKey[],
): boolean {
  const fkBroken = allForeignKeys.some((fk) => {
    const src = tables.find((t) => t.id === fk.sourceTableId);
    const tgt = tables.find((t) => t.id === fk.targetTableId);
    if (!src || !tgt) return true;
    return (
      !src.columns.find((c) => c.id === fk.sourceColumnId) ||
      !tgt.columns.find((c) => c.id === fk.targetColumnId)
    );
  });
  if (fkBroken) return true;
  return tables.some((table) =>
    table.indexes.some((idx) =>
      (idx.parts ?? []).some(
        (part) =>
          part.type === "column" &&
          !table.columns.find((c) => c.id === part.value),
      ),
    ),
  );
}
