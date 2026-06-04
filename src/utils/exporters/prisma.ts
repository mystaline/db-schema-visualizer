import type { Table, ForeignKey } from "../../stores/schemaStore";
import { pgTypeToPrisma } from "./pgTypeMap";

export interface PrismaResult {
  schema: string;
  warnings: string[];
}

function toModelName(name: string): string {
  const r = name
    .replace(/[^a-zA-Z0-9]/g, "_")
    .split("_")
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
  return r || "Model";
}

function toFieldName(name: string): string {
  let r = name.replace(/[^a-zA-Z0-9]/g, "_");
  r = r.replace(/_+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
  if (/^[0-9]/.test(r)) r = "_" + r;
  return r || "field_";
}

function toRelationFieldName(camelName: string): string {
  return camelName.replace(/Id$/, "") || camelName;
}

function formatPrismaDefault(value: string): string | null {
  const v = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  if (/^(true|false)$/i.test(v)) return v.toLowerCase();
  const strMatch = v.match(/^'(.*)'$/s);
  if (strMatch) return `"${strMatch[1]}"`;
  const lower = v.toLowerCase();
  if (lower === "now()" || lower === "current_timestamp") return "now()";
  if (lower === "gen_random_uuid()" || lower === "uuid_generate_v4()") return "uuid()";
  // Any other SQL expression → dbgenerated()
  const escaped = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `dbgenerated("${escaped}")`;
}

export function buildPrismaSchema(tables: Table[], foreignKeys: ForeignKey[]): PrismaResult {
  const warnings: string[] = [];
  const tableById = new Map(tables.map((t) => [t.id, t]));

  // Model names
  const usedModelNames = new Map<string, string>();
  const modelName = new Map<string, string>();
  for (const t of tables) {
    let name = toModelName(t.name);
    if (usedModelNames.has(name)) {
      warnings.push(`Model name conflict: "${t.name}" maps to "${name}" (already used) — rename one table`);
      let suffix = 2;
      while (usedModelNames.has(`${name}${suffix}`)) suffix++;
      name = `${name}${suffix}`;
    }
    usedModelNames.set(name, t.id);
    modelName.set(t.id, name);
  }

  // Field names per table
  const fieldName = new Map<string, string>();
  for (const t of tables) {
    const used = new Set<string>();
    for (const c of t.columns) {
      let name = toFieldName(c.name);
      if (used.has(name)) {
        let suffix = 2;
        while (used.has(`${name}${suffix}`)) suffix++;
        name = `${name}${suffix}`;
      }
      used.add(name);
      fieldName.set(c.id, name);
    }
  }

  // FK groupings
  const fksBySource = new Map<string, ForeignKey[]>();
  const fksByTarget = new Map<string, ForeignKey[]>();
  for (const fk of foreignKeys) {
    if (!fksBySource.has(fk.sourceTableId)) fksBySource.set(fk.sourceTableId, []);
    fksBySource.get(fk.sourceTableId)!.push(fk);
    if (!fksByTarget.has(fk.targetTableId)) fksByTarget.set(fk.targetTableId, []);
    fksByTarget.get(fk.targetTableId)!.push(fk);
  }

  // Determine which FKs need named relations (multi-FK between same pair, or self-referential)
  const pairCount = new Map<string, number>();
  for (const fk of foreignKeys) {
    const key = `${fk.sourceTableId}|${fk.targetTableId}`;
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
  }

  const relationName = new Map<string, string>();
  for (const fk of foreignKeys) {
    const isSelf = fk.sourceTableId === fk.targetTableId;
    const count = pairCount.get(`${fk.sourceTableId}|${fk.targetTableId}`) ?? 1;
    if (count > 1 || isSelf) {
      const srcModel = modelName.get(fk.sourceTableId) ?? "Unknown";
      const srcCol = tableById.get(fk.sourceTableId)?.columns.find((c) => c.id === fk.sourceColumnId);
      const relField = srcCol ? toRelationFieldName(toFieldName(srcCol.name)) : "rel";
      relationName.set(fk.id, `${srcModel}_${relField}`);
    }
  }

  // Relation field names (source side — separate from scalar FK column)
  const relFieldName = new Map<string, string>();
  for (const t of tables) {
    const usedFields = new Set<string>(t.columns.map((c) => fieldName.get(c.id)!));
    for (const fk of fksBySource.get(t.id) ?? []) {
      const srcCol = t.columns.find((c) => c.id === fk.sourceColumnId);
      let name = srcCol ? toRelationFieldName(fieldName.get(srcCol.id) ?? toFieldName(srcCol.name)) : "relation";
      if (usedFields.has(name)) {
        let suffix = 2;
        while (usedFields.has(`${name}${suffix}`)) suffix++;
        name = `${name}${suffix}`;
      }
      usedFields.add(name);
      relFieldName.set(fk.id, name);
    }
  }

  // Back-relation field names (target side)
  const backRelFieldName = new Map<string, string>();
  const backRelUsed = new Map<string, Set<string>>();
  for (const t of tables) backRelUsed.set(t.id, new Set());

  for (const fk of foreignKeys) {
    const srcTable = tableById.get(fk.sourceTableId);
    if (!srcTable) continue;
    const used = backRelUsed.get(fk.targetTableId)!;
    let name = toFieldName(srcTable.name);
    if (relationName.has(fk.id)) {
      const srcCol = srcTable.columns.find((c) => c.id === fk.sourceColumnId);
      const suffix = srcCol ? toRelationFieldName(toFieldName(srcCol.name)) : name;
      if (suffix !== name) name = `${name}_${suffix}`;
    }
    if (used.has(name)) {
      let s = 2;
      while (used.has(`${name}${s}`)) s++;
      name = `${name}${s}`;
    }
    used.add(name);
    backRelFieldName.set(fk.id, name);
  }

  // Build model blocks
  const modelBlocks: string[] = [];

  for (const t of tables) {
    const mName = modelName.get(t.id)!;
    const pkCols = t.columns.filter((c) => c.isPrimaryKey);
    const isCompositePk = pkCols.length > 1;

    if (pkCols.length === 0) {
      warnings.push(`Table "${t.name}" has no primary key — Prisma requires @id or @@id`);
    }

    const lines: string[] = [];

    // Scalar fields
    for (const c of t.columns) {
      const { scalar, nativeType, isSerial, isUnsupported } = pgTypeToPrisma(c.type);
      if (isUnsupported) {
        warnings.push(`Unsupported type "${c.type}" on "${t.name}.${c.name}" — mapped to ${scalar}`);
      }

      const fName = fieldName.get(c.id)!;
      const nullable = c.isNullable && !c.isPrimaryKey ? "?" : "";

      const parts: string[] = [`  ${fName}`, `${scalar}${nullable}`];
      if (nativeType) parts.push(nativeType);
      if (!isCompositePk && c.isPrimaryKey) parts.push("@id");
      if (isSerial && c.isPrimaryKey) {
        parts.push("@default(autoincrement())");
      } else if (c.defaultValue) {
        const def = formatPrismaDefault(c.defaultValue);
        if (def !== null) {
          parts.push(`@default(${def})`);
        }
      }
      if (c.isUnique && !c.isPrimaryKey) parts.push("@unique");
      if (fName !== c.name) parts.push(`@map("${c.name}")`);

      lines.push(parts.join("  "));
    }

    // Relation fields (source side)
    for (const fk of fksBySource.get(t.id) ?? []) {
      const target = tableById.get(fk.targetTableId);
      const srcCol = t.columns.find((c) => c.id === fk.sourceColumnId);
      const targetCol = target?.columns.find((c) => c.id === fk.targetColumnId);

      if (!target || !srcCol || !targetCol) {
        warnings.push(`FK from "${t.name}" skipped: referenced table or column not found`);
        continue;
      }

      const tgtModel = modelName.get(fk.targetTableId)!;
      const rField = relFieldName.get(fk.id)!;
      const srcFName = fieldName.get(srcCol.id)!;
      const tgtFName = fieldName.get(targetCol.id)!;
      const rName = relationName.get(fk.id);
      const nullable = srcCol.isNullable ? "?" : "";
      const nameArg = rName ? `"${rName}", ` : "";

      lines.push(`  ${rField}  ${tgtModel}${nullable}  @relation(${nameArg}fields: [${srcFName}], references: [${tgtFName}])`);
    }

    // Back-relation fields (target side)
    for (const fk of fksByTarget.get(t.id) ?? []) {
      const srcTable = tableById.get(fk.sourceTableId);
      const srcCol = srcTable?.columns.find((c) => c.id === fk.sourceColumnId);
      if (!srcTable || !srcCol) continue;

      const srcModel = modelName.get(fk.sourceTableId)!;
      const bField = backRelFieldName.get(fk.id)!;
      const rName = relationName.get(fk.id);
      const isOneToOne = srcCol.isUnique;
      const typeStr = isOneToOne ? `${srcModel}?` : `${srcModel}[]`;
      const nameAnnotation = rName ? `  @relation("${rName}")` : "";

      lines.push(`  ${bField}  ${typeStr}${nameAnnotation}`);
    }

    // Table-level directives
    const directives: string[] = [];

    if (isCompositePk) {
      const pkFields = pkCols.map((c) => fieldName.get(c.id)!).join(", ");
      directives.push(`  @@id([${pkFields}])`);
    }

    for (const idx of t.indexes) {
      const hasExpr =
        (idx.parts ?? []).some((p) => p.type === "expression") ||
        ((idx as any).expressions ?? []).length > 0;
      if (hasExpr) {
        warnings.push(`Expression index "${idx.name}" on "${t.name}" skipped — not supported in Prisma schema`);
        continue;
      }

      const idxCols = (idx.parts ?? [])
        .filter((p) => p.type === "column")
        .map((p) => {
          const c = t.columns.find((x) => x.id === p.value);
          return c ? fieldName.get(c.id)! : null;
        })
        .filter(Boolean) as string[];

      if (idxCols.length === 0) {
        warnings.push(`Index "${idx.name}" on "${t.name}" skipped — no resolvable column references`);
        continue;
      }

      // Single-column @@unique is redundant when the column already carries @unique
      if (idx.type === "unique" && idxCols.length === 1) {
        const colId = (idx.parts ?? []).find((p) => p.type === "column")?.value;
        const c = t.columns.find((x) => x.id === colId);
        if (c?.isUnique) continue;
      }

      directives.push(idx.type === "unique" ? `  @@unique([${idxCols.join(", ")}])` : `  @@index([${idxCols.join(", ")}])`);
    }

    for (const ck of t.checkConstraints) {
      warnings.push(`CHECK constraint "${ck.name}" on "${t.name}" skipped — not supported in Prisma schema`);
    }

    if (mName !== t.name) directives.push(`  @@map("${t.name}")`);

    const body = directives.length > 0 ? [...lines, "", ...directives] : lines;
    modelBlocks.push(`model ${mName} {\n${body.join("\n")}\n}`);
  }

  const header = [
    "// Generated by SchemaViz — https://app.schemaviz.mystaline.dev",
    "",
    "generator client {",
    '  provider = "prisma-client-js"',
    "}",
    "",
    "datasource db {",
    '  provider = "postgresql"',
    '  url      = env("DATABASE_URL")',
    "}",
  ].join("\n");

  const parts = [header, ...modelBlocks.map((b) => "\n" + b)];
  return { schema: parts.join("\n"), warnings };
}
