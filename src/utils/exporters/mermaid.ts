import type { Table, ForeignKey } from "../../stores/schemaStore";
import { pgTypeToMermaid } from "./pgTypeMap";

export interface MermaidResult {
  diagram: string;
  warnings: string[];
}

function safeId(name: string): string {
  return name.replace(/\s+/g, "_");
}

export function buildMermaidEr(tables: Table[], foreignKeys: ForeignKey[]): MermaidResult {
  const warnings: string[] = [];
  const headerComments: string[] = [];

  for (const table of tables) {
    for (const ck of table.checkConstraints) {
      headerComments.push(`%% CHECK ${ck.name}: ${ck.expression}`);
      warnings.push(`CHECK constraint dropped: CHECK ${ck.name} on ${table.name} (expression: ${ck.expression})`);
    }

    for (const idx of table.indexes) {
      const hasExpression =
        (idx.parts ?? []).some((p) => p.type === "expression") ||
        ((idx as any).expressions ?? []).length > 0;
      if (hasExpression) {
        headerComments.push(`%% INDEX ${idx.name} on ${table.name} (expression index — skipped)`);
        warnings.push(`Expression index dropped: ${idx.name} on ${table.name}`);
      }
    }
  }

  const tableById = new Map(tables.map((t) => [t.id, t]));
  const fkSourceColIds = new Set(foreignKeys.map((fk) => fk.sourceColumnId));

  const lines: string[] = ["erDiagram"];
  if (headerComments.length > 0) lines.push(...headerComments);

  for (const table of tables) {
    lines.push(`  ${safeId(table.name)} {`);
    for (const col of table.columns) {
      const mermaidType = pgTypeToMermaid(col.type);
      const isFk = fkSourceColIds.has(col.id);
      let attrs = "";
      if (col.isPrimaryKey && isFk) attrs = " PK, FK";
      else if (col.isPrimaryKey) attrs = " PK";
      else if (col.isUnique && isFk) attrs = " UK, FK";
      else if (isFk) attrs = " FK";
      else if (col.isUnique) attrs = " UK";
      lines.push(`    ${mermaidType} ${safeId(col.name)}${attrs}`);
    }
    lines.push("  }");
  }

  for (const fk of foreignKeys) {
    const sourceTable = tableById.get(fk.sourceTableId);
    const targetTable = tableById.get(fk.targetTableId);
    if (!sourceTable || !targetTable) {
      const missingId = !sourceTable ? fk.sourceTableId : fk.targetTableId;
      warnings.push(`Foreign key skipped: referenced table ID "${missingId}" not found in schema`);
      continue;
    }

    const sourceCol = sourceTable.columns.find((c) => c.id === fk.sourceColumnId);
    const targetCol = targetTable.columns.find((c) => c.id === fk.targetColumnId);
    if (!sourceCol || !targetCol) {
      const which = !sourceCol
        ? `source column "${fk.sourceColumnId}" in table "${sourceTable.name}"`
        : `target column "${fk.targetColumnId}" in table "${targetTable.name}"`;
      warnings.push(`Foreign key skipped: ${which} not found`);
      continue;
    }

    const targetCard = targetCol.isUnique || targetCol.isPrimaryKey ? "||" : "|{";
    const sourceCard = sourceCol.isNullable ? "o{" : "|{";
    const label = sourceCol.name.replace(/"/g, "'");

    lines.push(`  ${safeId(targetTable.name)} ${targetCard}--${sourceCard} ${safeId(sourceTable.name)} : "${label}"`);
  }

  return { diagram: lines.join("\n"), warnings };
}
