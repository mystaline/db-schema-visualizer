import type { Table, ForeignKey } from "../stores/schemaStore";
import { uuid } from "./uuid";
import {
  splitByTopLevelComma,
  parseDefault,
  parseAction,
  parseColumnLine,
  parseCheckConstraintLine,
} from "./sqlParsing";

/**
 * Folds an ordered sequence of migration files (a baseline CREATE TABLE file
 * plus incremental ALTER/DROP/RENAME delta files — the shape of a real
 * migration tool's versioned `.up.sql` history) into one consolidated
 * schema snapshot. `ddlParser.ts`'s single-blob `parseDDL` is a thin wrapper
 * around this, called with exactly one file — there is one statement-handling
 * code path, not two.
 */

// ---------- Public types ----------

export interface ParsedSchema {
  tables: Table[];
  foreignKeys: ForeignKey[];
}

export interface MigrationFile {
  version: string;
  filename?: string;
  sql: string;
}

export type SchemaChange =
  | { kind: "create_table"; tableName: string }
  | { kind: "drop_table"; tableName: string }
  | { kind: "rename_table"; from: string; to: string }
  | { kind: "add_column"; tableName: string; columnName: string }
  | { kind: "drop_column"; tableName: string; columnName: string }
  | { kind: "rename_column"; tableName: string; from: string; to: string }
  | { kind: "alter_column"; tableName: string; columnName: string; detail: string }
  | { kind: "add_foreign_key"; tableName: string; columnNames: string[] }
  | { kind: "add_unique_constraint"; tableName: string; columnNames: string[] }
  | { kind: "add_check_constraint"; tableName: string; name: string }
  | { kind: "drop_constraint"; tableName: string; constraintName: string }
  | { kind: "create_index"; tableName: string; indexName: string }
  | { kind: "drop_index"; indexName: string }
  | { kind: "unrecognized_statement"; statement: string };

export interface VersionDelta {
  version: string;
  filename?: string;
  changes: SchemaChange[];
  warnings: string[];
}

export interface FoldResult {
  snapshot: ParsedSchema;
  history: VersionDelta[]; // retained, not consumed by any UI yet
  warnings: string[]; // flattened across all files, for a single toast
}

// ---------- Internal accumulator ----------

interface PendingFK {
  sourceTableName: string;
  sourceColName: string;
  targetTableName: string;
  targetColName: string;
  suffix: string;
  constraintName?: string;
}

interface Accumulator {
  tables: Table[];
  tableMap: Map<string, Table>; // current name -> Table
  colNameToIdMap: Map<string, Map<string, string>>; // table name -> col name -> col id
  foreignKeys: ForeignKey[];
  fkConstraintNames: Map<string, string>; // fk.id -> authored constraint name
  nameAliases: Map<string, string>; // old table name -> current name (chain-compressed)
}

function createAccumulator(): Accumulator {
  return {
    tables: [],
    tableMap: new Map(),
    colNameToIdMap: new Map(),
    foreignKeys: [],
    fkConstraintNames: new Map(),
    nameAliases: new Map(),
  };
}

function resolveTableName(acc: Accumulator, name: string): string {
  return acc.nameAliases.get(name) ?? name;
}

function findTable(acc: Accumulator, name: string): Table | undefined {
  return acc.tableMap.get(name) ?? acc.tableMap.get(resolveTableName(acc, name));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncate(s: string, max = 120): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

// ---------- Cascade functions ----------
// Deliberately NOT shared with schemaStore.ts's interactive-edit cascades:
// the store regenerates index/constraint names from a naming convention
// (correct there, since the UI always synthesizes those names), but folded
// migration history has literal author-written index/constraint names —
// reusing the store's cascade would silently overwrite them. So these
// rewrite expression *text* on rename but never touch `.name`.

function dropTable(acc: Accumulator, tableName: string): boolean {
  const table = findTable(acc, tableName);
  if (!table) return false;
  acc.tables = acc.tables.filter((t) => t.id !== table.id);
  acc.tableMap.delete(table.name);
  acc.colNameToIdMap.delete(table.name);
  acc.foreignKeys = acc.foreignKeys.filter(
    (fk) => fk.sourceTableId !== table.id && fk.targetTableId !== table.id,
  );
  return true;
}

function dropColumn(acc: Accumulator, tableName: string, columnName: string): boolean {
  const table = findTable(acc, tableName);
  if (!table) return false;
  const column = table.columns.find((c) => c.name === columnName);
  if (!column) return false;
  const columnId = column.id;

  table.columns = table.columns.filter((c) => c.id !== columnId);
  acc.colNameToIdMap.get(table.name)?.delete(columnName);
  acc.foreignKeys = acc.foreignKeys.filter(
    (fk) => fk.sourceColumnId !== columnId && fk.targetColumnId !== columnId,
  );
  table.indexes = table.indexes.filter((idx) => {
    const usesColumn = idx.parts.some((part) => {
      if (part.type === "column") return part.value === columnId;
      if (part.type === "expression") {
        return new RegExp(`\\b${escapeRegex(columnName)}\\b`, "i").test(part.value);
      }
      return false;
    });
    return !usesColumn;
  });
  table.checkConstraints = table.checkConstraints.filter(
    (chk) => !new RegExp(`\\b${escapeRegex(columnName)}\\b`, "i").test(chk.expression),
  );
  return true;
}

function renameTable(acc: Accumulator, oldName: string, newName: string): boolean {
  const table = findTable(acc, oldName);
  if (!table) return false;
  const actualOldName = table.name; // may differ from oldName if oldName was itself an alias

  acc.tableMap.delete(actualOldName);
  table.name = newName;
  acc.tableMap.set(newName, table);

  const cols = acc.colNameToIdMap.get(actualOldName);
  if (cols) {
    acc.colNameToIdMap.delete(actualOldName);
    acc.colNameToIdMap.set(newName, cols);
  }

  // Chain-compress: anything that pointed at actualOldName now points at newName.
  for (const [k, v] of acc.nameAliases) {
    if (v === actualOldName) acc.nameAliases.set(k, newName);
  }
  acc.nameAliases.set(actualOldName, newName);
  return true;
}

function renameColumn(
  acc: Accumulator,
  tableName: string,
  oldName: string,
  newName: string,
): boolean {
  const table = findTable(acc, tableName);
  if (!table) return false;
  const column = table.columns.find((c) => c.name === oldName);
  if (!column) return false;

  column.name = newName;
  const colMap = acc.colNameToIdMap.get(table.name);
  if (colMap) {
    const id = colMap.get(oldName);
    colMap.delete(oldName);
    if (id) colMap.set(newName, id);
  }

  const rx = new RegExp(`\\b${escapeRegex(oldName)}\\b`, "gi");
  table.indexes.forEach((idx) => {
    idx.parts.forEach((part) => {
      if (part.type === "expression") part.value = part.value.replace(rx, newName);
    });
  });
  table.checkConstraints.forEach((chk) => {
    chk.expression = chk.expression.replace(rx, newName);
  });
  return true;
}

function dropConstraint(acc: Accumulator, tableName: string, constraintName: string): boolean {
  const table = findTable(acc, tableName);
  if (!table) return false;

  const beforeChk = table.checkConstraints.length;
  table.checkConstraints = table.checkConstraints.filter((c) => c.name !== constraintName);
  if (table.checkConstraints.length !== beforeChk) return true;

  const beforeIdx = table.indexes.length;
  table.indexes = table.indexes.filter((i) => i.name !== constraintName);
  if (table.indexes.length !== beforeIdx) return true;

  for (const [fkId, name] of acc.fkConstraintNames) {
    if (name === constraintName) {
      acc.foreignKeys = acc.foreignKeys.filter((fk) => fk.id !== fkId);
      acc.fkConstraintNames.delete(fkId);
      return true;
    }
  }
  return false;
}

function dropIndex(acc: Accumulator, indexName: string): boolean {
  let found = false;
  for (const table of acc.tables) {
    const before = table.indexes.length;
    table.indexes = table.indexes.filter((i) => i.name !== indexName);
    if (table.indexes.length !== before) found = true;
  }
  return found;
}

// ---------- CREATE TABLE / ALTER FK / CREATE INDEX ----------
// Ported from the original single-purpose ddlParser.ts, same regexes and
// priority order, so behavior for existing single-blob input is unchanged.

function applyCreateTable(
  acc: Accumulator,
  match: RegExpMatchArray,
  pendingFKs: PendingFK[],
  changes: SchemaChange[],
): void {
  const originalTableName = match[1] || match[2] || match[3];
  const body = match[4];

  const tableId = uuid();
  const table: Table = {
    id: tableId,
    name: originalTableName,
    x: 0,
    y: 0,
    columns: [],
    indexes: [],
    checkConstraints: [],
  };

  acc.tables.push(table);
  acc.tableMap.set(originalTableName, table);
  acc.colNameToIdMap.set(originalTableName, new Map());

  const lines = splitByTopLevelComma(body);
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const pkMatch = line.match(/^PRIMARY\s+KEY\s*\((.*)\)/i);
    if (pkMatch) {
      const pkCols = pkMatch[1].split(",").map((c) => c.trim().replace(/"/g, ""));
      pkCols.forEach((colName) => {
        const col = table.columns.find((c) => c.name === colName);
        if (col) col.isPrimaryKey = true;
      });
      continue;
    }

    const inlineFkMatch = line.match(
      /(?:CONSTRAINT\s+([a-zA-Z0-9_"]+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:"([^"]+)"|([a-zA-Z0-9_.]+))\s*\(([^)]+)\)(.*)/i,
    );
    if (inlineFkMatch) {
      const sourceColNames = inlineFkMatch[2].split(",").map((c) => c.trim().replace(/"/g, ""));
      const targetTableName = inlineFkMatch[3] || inlineFkMatch[4];
      const targetColNames = inlineFkMatch[5].split(",").map((c) => c.trim().replace(/"/g, ""));
      const suffix = inlineFkMatch[6] || "";

      sourceColNames.forEach((sColName, idx) => {
        pendingFKs.push({
          sourceTableName: originalTableName,
          sourceColName: sColName,
          targetTableName,
          targetColName: targetColNames[idx],
          suffix,
          constraintName: inlineFkMatch[1]?.replace(/"/g, ""),
        });
      });
      continue;
    }

    const checkResult = parseCheckConstraintLine(line);
    if (checkResult) {
      table.checkConstraints.push({
        id: uuid(),
        name: checkResult.name ?? `chk_${originalTableName}_${table.checkConstraints.length + 1}`,
        expression: checkResult.expression,
      });
      continue;
    }

    const colResult = parseColumnLine(line);
    if (colResult) {
      table.columns.push(colResult.column);
      acc.colNameToIdMap.get(originalTableName)?.set(colResult.column.name, colResult.column.id);
      if (colResult.inlineReference) {
        pendingFKs.push({
          sourceTableName: originalTableName,
          sourceColName: colResult.column.name,
          targetTableName: colResult.inlineReference.targetTableName,
          targetColName: colResult.inlineReference.targetColName,
          suffix: colResult.inlineReference.suffix,
        });
      }
    }
  }

  changes.push({ kind: "create_table", tableName: originalTableName });
}

function applyCreateIndex(
  acc: Accumulator,
  match: RegExpMatchArray,
  changes: SchemaChange[],
): void {
  const isUnique = !!match[1];
  const indexName = match[2] || match[3] || match[4];
  const tableName = match[5] || match[6] || match[7];
  const partsStr = match[8];
  const suffix = match[9] || "";

  const table = findTable(acc, tableName);
  if (!table) return; // matches original silent-drop behavior for a missing target table

  const parts = splitByTopLevelComma(partsStr).map((p) => {
    const orderMatch = p.match(/(.*)\s+(ASC|DESC)$/i);
    const order = (orderMatch?.[2].toUpperCase() as "ASC" | "DESC") || "ASC";
    const val = orderMatch ? orderMatch[1].trim() : p.trim();

    const cleanVal = val.replace(/"/g, "");
    const colId = acc.colNameToIdMap.get(table.name)?.get(cleanVal);

    if (colId) {
      return { type: "column" as const, value: colId, order };
    }
    const expr = val.startsWith("(") && val.endsWith(")") ? val.slice(1, -1) : val;
    return { type: "expression" as const, value: expr, order };
  });

  const filterMatch = suffix.match(/WHERE\s+(.*)/i);

  table.indexes.push({
    id: uuid(),
    name: indexName,
    type: isUnique ? "unique" : "normal",
    parts,
    filter: filterMatch?.[1].trim(),
  });

  changes.push({ kind: "create_index", tableName: table.name, indexName });
}

// ---------- New statement handlers ----------

function applyAlterClause(
  acc: Accumulator,
  tableName: string,
  clause: string,
  pendingFKs: PendingFK[],
  changes: SchemaChange[],
  warnings: string[],
): void {
  // ADD [COLUMN] [IF NOT EXISTS] <coldef>  (guarded against ADD CONSTRAINT, which
  // would otherwise also match the optional "COLUMN" group)
  if (!/^ADD\s+CONSTRAINT/i.test(clause)) {
    const addColMatch = clause.match(/^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(.+)$/i);
    if (addColMatch) {
      const colResult = parseColumnLine(addColMatch[1]);
      const table = findTable(acc, tableName);
      if (!table) {
        warnings.push(`ALTER TABLE ${tableName} ADD COLUMN: table not found`);
        return;
      }
      if (colResult) {
        table.columns.push(colResult.column);
        acc.colNameToIdMap.get(table.name)?.set(colResult.column.name, colResult.column.id);
        changes.push({ kind: "add_column", tableName: table.name, columnName: colResult.column.name });
        return;
      }
    }
  }

  // DROP COLUMN [IF EXISTS] name [CASCADE|RESTRICT]
  const dropColMatch = clause.match(
    /^DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))(?:\s+(?:CASCADE|RESTRICT))?$/i,
  );
  if (dropColMatch) {
    const columnName = dropColMatch[1] || dropColMatch[2] || dropColMatch[3];
    const hasIfExists = /IF\s+EXISTS/i.test(clause);
    const ok = dropColumn(acc, tableName, columnName);
    if (ok) {
      changes.push({ kind: "drop_column", tableName, columnName });
    } else if (!hasIfExists) {
      warnings.push(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}: column not found`);
    }
    return;
  }

  // ADD CONSTRAINT name FOREIGN KEY (...) REFERENCES t(...)  (clause form, for
  // statements combining an FK add with other actions in one ALTER TABLE)
  const fkClauseMatch = clause.match(
    /^ADD\s+CONSTRAINT\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_.]+))\s*\(([^)]+)\)(.*)$/i,
  );
  if (fkClauseMatch) {
    const constraintName = fkClauseMatch[1] || fkClauseMatch[2] || fkClauseMatch[3];
    const sourceColNames = fkClauseMatch[4].split(",").map((c) => c.trim().replace(/["`]/g, ""));
    const targetTableName = fkClauseMatch[5] || fkClauseMatch[6] || fkClauseMatch[7];
    const targetColNames = fkClauseMatch[8].split(",").map((c) => c.trim().replace(/["`]/g, ""));
    const suffix = fkClauseMatch[9] || "";

    sourceColNames.forEach((sColName, idx) => {
      pendingFKs.push({
        sourceTableName: tableName,
        sourceColName: sColName,
        targetTableName,
        targetColName: targetColNames[idx],
        suffix,
        constraintName,
      });
    });
    changes.push({ kind: "add_foreign_key", tableName, columnNames: sourceColNames });
    return;
  }

  // ADD CONSTRAINT name UNIQUE (cols...) — modeled as a unique TableIndex, same
  // representation CREATE UNIQUE INDEX already uses.
  const uniqueMatch = clause.match(
    /^ADD\s+CONSTRAINT\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))\s+UNIQUE\s*\(([^)]+)\)$/i,
  );
  if (uniqueMatch) {
    const constraintName = uniqueMatch[1] || uniqueMatch[2] || uniqueMatch[3];
    const colNames = uniqueMatch[4].split(",").map((c) => c.trim().replace(/["`]/g, ""));
    const table = findTable(acc, tableName);
    if (!table) {
      warnings.push(`ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} UNIQUE: table not found`);
      return;
    }
    const colIds = colNames
      .map((c) => acc.colNameToIdMap.get(table.name)?.get(c))
      .filter((id): id is string => !!id);
    if (colIds.length !== colNames.length) {
      warnings.push(
        `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} UNIQUE: unresolved column(s)`,
      );
      return;
    }
    table.indexes.push({
      id: uuid(),
      name: constraintName,
      type: "unique",
      parts: colIds.map((id) => ({ type: "column" as const, value: id, order: "ASC" as const })),
    });
    if (colIds.length === 1) {
      const col = table.columns.find((c) => c.id === colIds[0]);
      if (col) col.isUnique = true;
    }
    changes.push({ kind: "add_unique_constraint", tableName: table.name, columnNames: colNames });
    return;
  }

  // ADD CONSTRAINT name CHECK (expr)
  const checkClauseMatch = clause.match(
    /^ADD\s+CONSTRAINT\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))\s+CHECK\s*\((.+)\)$/i,
  );
  if (checkClauseMatch) {
    const constraintName = checkClauseMatch[1] || checkClauseMatch[2] || checkClauseMatch[3];
    const expression = checkClauseMatch[4].trim();
    const table = findTable(acc, tableName);
    if (!table) {
      warnings.push(`ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} CHECK: table not found`);
      return;
    }
    table.checkConstraints.push({ id: uuid(), name: constraintName, expression });
    changes.push({ kind: "add_check_constraint", tableName: table.name, name: constraintName });
    return;
  }

  // DROP CONSTRAINT [IF EXISTS] name
  const dropConstraintMatch = clause.match(
    /^DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))$/i,
  );
  if (dropConstraintMatch) {
    const constraintName = dropConstraintMatch[1] || dropConstraintMatch[2] || dropConstraintMatch[3];
    const hasIfExists = /IF\s+EXISTS/i.test(clause);
    const ok = dropConstraint(acc, tableName, constraintName);
    if (ok) {
      changes.push({ kind: "drop_constraint", tableName, constraintName });
    } else if (!hasIfExists) {
      warnings.push(`ALTER TABLE ${tableName} DROP CONSTRAINT ${constraintName}: not found`);
    }
    return;
  }

  // ALTER [COLUMN] col ( [SET DATA] TYPE t | SET DEFAULT expr | DROP DEFAULT |
  //                        SET NOT NULL | DROP NOT NULL )
  const alterColMatch = clause.match(
    /^ALTER\s+(?:COLUMN\s+)?(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))\s+(.+)$/i,
  );
  if (alterColMatch) {
    const columnName = alterColMatch[1] || alterColMatch[2] || alterColMatch[3];
    const rest = alterColMatch[4].trim();
    const table = findTable(acc, tableName);
    const column = table?.columns.find((c) => c.name === columnName);
    if (!table || !column) {
      warnings.push(`ALTER TABLE ${tableName} ALTER COLUMN ${columnName}: column not found`);
      return;
    }

    const typeMatch = rest.match(/^(?:SET\s+DATA\s+)?TYPE\s+(.+)$/i);
    if (typeMatch) {
      column.type = typeMatch[1].trim().toLowerCase();
      changes.push({ kind: "alter_column", tableName, columnName, detail: "type" });
      return;
    }
    if (/^SET\s+DEFAULT\s+/i.test(rest)) {
      column.defaultValue = parseDefault(rest);
      changes.push({ kind: "alter_column", tableName, columnName, detail: "default" });
      return;
    }
    if (/^DROP\s+DEFAULT$/i.test(rest)) {
      column.defaultValue = null;
      changes.push({ kind: "alter_column", tableName, columnName, detail: "default" });
      return;
    }
    if (/^SET\s+NOT\s+NULL$/i.test(rest)) {
      column.isNullable = false;
      changes.push({ kind: "alter_column", tableName, columnName, detail: "not_null" });
      return;
    }
    if (/^DROP\s+NOT\s+NULL$/i.test(rest)) {
      column.isNullable = true;
      changes.push({ kind: "alter_column", tableName, columnName, detail: "not_null" });
      return;
    }

    warnings.push(`ALTER TABLE ${tableName} ALTER COLUMN ${columnName}: unrecognized clause "${rest}"`);
    changes.push({ kind: "unrecognized_statement", statement: clause });
    return;
  }

  warnings.push(`Skipped unrecognized ALTER TABLE clause on "${tableName}": ${truncate(clause)}`);
  changes.push({ kind: "unrecognized_statement", statement: clause });
}

function applyStatement(
  acc: Accumulator,
  statement: string,
  pendingFKs: PendingFK[],
  changes: SchemaChange[],
  warnings: string[],
): void {
  // 1. CREATE TABLE
  const createTableMatch = statement.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_.]+))\s*\(([\s\S]*)\)/i,
  );
  if (createTableMatch) {
    applyCreateTable(acc, createTableMatch, pendingFKs, changes);
    return;
  }

  // 2. ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY (whole-statement fast path,
  //    preserved from the original single-purpose parser for exact backward
  //    compatibility, with an additive fix: the quoted-constraint-name
  //    alternative is now captured too, needed for DROP CONSTRAINT support —
  //    the original discarded the constraint name entirely).
  const fkMatch = statement.match(
    /ALTER\s+TABLE\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_.]+))\s+ADD\s+CONSTRAINT\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_.]+))\s*\(([^)]+)\)(.*)/i,
  );
  if (fkMatch) {
    const sourceTableName = fkMatch[1] || fkMatch[2] || fkMatch[3];
    const constraintName = fkMatch[4] || fkMatch[5] || fkMatch[6];
    const sourceColNames = fkMatch[7].split(",").map((c) => c.trim().replace(/["`]/g, ""));
    const targetTableName = fkMatch[8] || fkMatch[9] || fkMatch[10];
    const targetColNames = fkMatch[11].split(",").map((c) => c.trim().replace(/["`]/g, ""));
    const suffix = fkMatch[12] || "";

    sourceColNames.forEach((sColName, idx) => {
      pendingFKs.push({
        sourceTableName,
        sourceColName: sColName,
        targetTableName,
        targetColName: targetColNames[idx],
        suffix,
        constraintName,
      });
    });
    changes.push({ kind: "add_foreign_key", tableName: sourceTableName, columnNames: sourceColNames });
    return;
  }

  // 3. CREATE INDEX
  const indexMatch = statement.match(
    /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))\s+ON\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_.]+))\s*\((.*)\)(.*)/i,
  );
  if (indexMatch) {
    applyCreateIndex(acc, indexMatch, changes);
    return;
  }

  // 4. DROP TABLE [IF EXISTS] name[, name2, ...] [CASCADE|RESTRICT]
  const dropTableMatch = statement.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(.+)$/i);
  if (dropTableMatch) {
    const hasIfExists = /IF\s+EXISTS/i.test(statement);
    const rest = dropTableMatch[1].trim().replace(/\s+(?:CASCADE|RESTRICT)$/i, "");
    const names = splitByTopLevelComma(rest).map((n) =>
      n.trim().replace(/^"|"$/g, "").replace(/^`|`$/g, ""),
    );
    names.forEach((tableName) => {
      const ok = dropTable(acc, tableName);
      if (ok) {
        changes.push({ kind: "drop_table", tableName });
      } else if (!hasIfExists) {
        warnings.push(`DROP TABLE ${tableName}: table not found (statement may be out of order)`);
      }
    });
    return;
  }

  // 5. ALTER TABLE ... RENAME TO ...  (standalone-only in Postgres, must be
  //    checked before the generic ALTER TABLE clause dispatch below)
  const renameTableMatch = statement.match(
    /^ALTER\s+TABLE\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_.]+))\s+RENAME\s+TO\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_.]+))$/i,
  );
  if (renameTableMatch) {
    const oldName = renameTableMatch[1] || renameTableMatch[2] || renameTableMatch[3];
    const newName = renameTableMatch[4] || renameTableMatch[5] || renameTableMatch[6];
    const ok = renameTable(acc, oldName, newName);
    if (ok) {
      changes.push({ kind: "rename_table", from: oldName, to: newName });
    } else {
      warnings.push(`ALTER TABLE RENAME: table "${oldName}" not found`);
    }
    return;
  }

  // 6. ALTER TABLE ... RENAME COLUMN ... TO ...  (standalone-only)
  const renameColumnMatch = statement.match(
    /^ALTER\s+TABLE\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_.]+))\s+RENAME\s+COLUMN\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))\s+TO\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))$/i,
  );
  if (renameColumnMatch) {
    const tableName = renameColumnMatch[1] || renameColumnMatch[2] || renameColumnMatch[3];
    const oldCol = renameColumnMatch[4] || renameColumnMatch[5] || renameColumnMatch[6];
    const newCol = renameColumnMatch[7] || renameColumnMatch[8] || renameColumnMatch[9];
    const ok = renameColumn(acc, tableName, oldCol, newCol);
    if (ok) {
      changes.push({ kind: "rename_column", tableName, from: oldCol, to: newCol });
    } else {
      warnings.push(`ALTER TABLE RENAME COLUMN: "${tableName}.${oldCol}" not found`);
    }
    return;
  }

  // 7. DROP INDEX [CONCURRENTLY] [IF EXISTS] name[, name2, ...]  (schema-scoped,
  //    no table clause — scan all tables)
  const dropIndexMatch = statement.match(
    /^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?(.+)$/i,
  );
  if (dropIndexMatch) {
    const hasIfExists = /IF\s+EXISTS/i.test(statement);
    const names = splitByTopLevelComma(dropIndexMatch[1]).map((n) =>
      n.trim().replace(/^"|"$/g, "").replace(/^`|`$/g, ""),
    );
    names.forEach((indexName) => {
      const ok = dropIndex(acc, indexName);
      if (ok) {
        changes.push({ kind: "drop_index", indexName });
      } else if (!hasIfExists) {
        warnings.push(`DROP INDEX ${indexName}: index not found`);
      }
    });
    return;
  }

  // 8. Generic ALTER TABLE dispatch: ADD/DROP COLUMN, ALTER COLUMN, ADD/DROP
  //    CONSTRAINT. Postgres allows comma-separated action clauses in one
  //    statement (`ALTER TABLE t ADD COLUMN a int, DROP COLUMN b`), so the
  //    tail is split the same paren-depth-aware way as a column list and each
  //    clause is dispatched independently.
  const alterTableMatch = statement.match(
    /^ALTER\s+TABLE\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_.]+))\s+([\s\S]+)$/i,
  );
  if (alterTableMatch) {
    const tableName = alterTableMatch[1] || alterTableMatch[2] || alterTableMatch[3];
    const tail = alterTableMatch[4];
    const clauses = splitByTopLevelComma(tail);
    clauses.forEach((clause) => {
      applyAlterClause(acc, tableName, clause.trim(), pendingFKs, changes, warnings);
    });
    return;
  }

  // 9. Nothing recognized — e.g. CREATE TRIGGER, DO $$...$$ blocks, custom
  //    types. Skip and record, never abort the whole fold over one statement.
  changes.push({ kind: "unrecognized_statement", statement });
  warnings.push(`Skipped unrecognized statement: ${truncate(statement)}`);
}

function resolvePendingFK(
  acc: Accumulator,
  p: PendingFK,
  warnings: string[],
): void {
  const sTable = findTable(acc, p.sourceTableName);
  const tTable = findTable(acc, p.targetTableName);
  if (!sTable || !tTable) {
    warnings.push(
      `Foreign key ${p.sourceTableName}.${p.sourceColName} -> ${p.targetTableName}.${p.targetColName}: table not found`,
    );
    return;
  }
  const sColId = acc.colNameToIdMap.get(sTable.name)?.get(p.sourceColName);
  const tColId = acc.colNameToIdMap.get(tTable.name)?.get(p.targetColName);
  if (!sColId || !tColId) {
    warnings.push(
      `Foreign key ${p.sourceTableName}.${p.sourceColName} -> ${p.targetTableName}.${p.targetColName}: column not found`,
    );
    return;
  }

  const fkId = uuid();
  acc.foreignKeys.push({
    id: fkId,
    sourceTableId: sTable.id,
    sourceColumnId: sColId,
    targetTableId: tTable.id,
    targetColumnId: tColId,
    onDelete: parseAction(p.suffix, "DELETE"),
    onUpdate: parseAction(p.suffix, "UPDATE"),
  });
  if (p.constraintName) {
    acc.fkConstraintNames.set(fkId, p.constraintName);
  }
}

function splitStatements(sql: string): string[] {
  const cleanSql = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
  return cleanSql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function sortFiles(files: MigrationFile[]): MigrationFile[] {
  const allNumeric = files.every((f) => f.version !== "" && Number.isFinite(Number(f.version)));
  const sorted = [...files];
  if (allNumeric) {
    sorted.sort((a, b) => Number(a.version) - Number(b.version));
  } else {
    sorted.sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
  }
  return sorted;
}

// ---------- Public entry point ----------

export function foldMigrationHistory(files: MigrationFile[]): FoldResult {
  const sorted = sortFiles(files);
  const acc = createAccumulator();
  const history: VersionDelta[] = [];
  const allWarnings: string[] = [];

  for (const file of sorted) {
    const changes: SchemaChange[] = [];
    const warnings: string[] = [];
    const pendingFKs: PendingFK[] = [];

    const statements = splitStatements(file.sql);
    for (const statement of statements) {
      applyStatement(acc, statement, pendingFKs, changes, warnings);
    }

    // Resolve this file's FK references at the end of THIS file's statement
    // loop, not deferred to the whole batch: FKs resolve by table/column id,
    // and renames only ever update the name->id mapping (never the id
    // itself), so a table renamed earlier in this same file or in an earlier
    // file is already visible by the time this file's FKs are resolved.
    for (const p of pendingFKs) {
      resolvePendingFK(acc, p, warnings);
    }

    history.push({ version: file.version, filename: file.filename, changes, warnings });
    allWarnings.push(...warnings);
  }

  return {
    snapshot: { tables: acc.tables, foreignKeys: acc.foreignKeys },
    history,
    warnings: allWarnings,
  };
}
