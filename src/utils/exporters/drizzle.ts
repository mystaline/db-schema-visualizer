import type { Table, ForeignKey } from "../../stores/schemaStore";

export interface DrizzleTypeInfo {
  helper: string;
  options?: string;
  isUnsupported?: boolean;
}

export function pgTypeToDrizzle(pgType: string): DrizzleTypeInfo {
  if (!pgType || !pgType.trim()) return { helper: "text", isUnsupported: true };

  const raw = pgType.trim().toLowerCase();
  const base = raw.replace(/\(.*\)/s, "").trim();

  const lenMatch = raw.match(/\((\d+)\)/);
  const psMatch = raw.match(/\((\d+)\s*(?:,\s*(\d+))?\)/);
  const length = lenMatch ? parseInt(lenMatch[1]) : undefined;
  const precision = psMatch ? parseInt(psMatch[1]) : undefined;
  const scale = psMatch && psMatch[2] ? parseInt(psMatch[2]) : undefined;

  if (["integer", "int", "int4"].includes(base)) return { helper: "integer" };
  if (["bigint", "int8"].includes(base)) return { helper: "bigint", options: '{ mode: "number" }' };
  if (["smallint", "int2"].includes(base)) return { helper: "smallint" };
  if (["serial"].includes(base)) return { helper: "serial" };
  if (["bigserial"].includes(base)) return { helper: "bigserial" };
  if (["text"].includes(base)) return { helper: "text" };
  if (["varchar", "character varying"].includes(base))
    return length ? { helper: "varchar", options: `{ length: ${length} }` } : { helper: "varchar" };
  if (["char", "character"].includes(base))
    return length ? { helper: "char", options: `{ length: ${length} }` } : { helper: "char" };
  if (["boolean", "bool"].includes(base)) return { helper: "boolean" };
  if (["uuid"].includes(base)) return { helper: "uuid" };
  if (["timestamp", "timestamp without time zone"].includes(base)) return { helper: "timestamp" };
  if (["timestamptz", "timestamp with time zone"].includes(base))
    return { helper: "timestamp", options: "{ withTimezone: true }" };
  if (["date"].includes(base)) return { helper: "date" };
  if (["time", "time without time zone"].includes(base)) return { helper: "time" };
  if (["timetz", "time with time zone"].includes(base))
    return { helper: "time", options: "{ withTimezone: true }" };
  if (["json"].includes(base)) return { helper: "json" };
  if (["jsonb"].includes(base)) return { helper: "jsonb" };
  if (["numeric", "decimal"].includes(base)) {
    if (precision !== undefined && scale !== undefined) return { helper: "numeric", options: `{ precision: ${precision}, scale: ${scale} }` };
    if (precision !== undefined) return { helper: "numeric", options: `{ precision: ${precision} }` };
    return { helper: "numeric" };
  }
  if (["real", "float4"].includes(base)) return { helper: "real" };
  if (["double precision", "float8", "float"].includes(base)) return { helper: "doublePrecision" };
  if (["interval"].includes(base)) return { helper: "interval" };

  return { helper: "text", isUnsupported: true };
}

export interface DrizzleResult {
  schema: string;
  warnings: string[];
}

function toVarName(name: string): string {
  let r = name.replace(/[^a-zA-Z0-9]/g, "_");
  r = r.replace(/_+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
  if (/^[0-9]/.test(r)) r = "_" + r;
  return r || "table_";
}

const FK_ACTION_MAP: Record<string, string> = {
  "CASCADE": "cascade",
  "SET NULL": "set null",
  "RESTRICT": "restrict",
  "NO ACTION": "no action",
  "SET DEFAULT": "set default",
};

function formatDefault(value: string): { expr: string; needsSql: boolean } {
  const v = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(v)) return { expr: v, needsSql: false };
  if (/^(true|false)$/i.test(v)) return { expr: v.toLowerCase(), needsSql: false };
  const strMatch = v.match(/^'(.*)'$/s);
  if (strMatch) return { expr: JSON.stringify(strMatch[1]), needsSql: false };
  const escaped = v.replace(/`/g, "\\`");
  return { expr: `sql\`${escaped}\``, needsSql: true };
}

function topoSort(tables: Table[], foreignKeys: ForeignKey[]): { sorted: Table[]; hasCycle: boolean; cycleNames: string[] } {
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const deps = new Map<string, Set<string>>();
  for (const t of tables) deps.set(t.id, new Set());
  for (const fk of foreignKeys) {
    if (fk.sourceTableId !== fk.targetTableId && tableById.has(fk.sourceTableId) && tableById.has(fk.targetTableId)) {
      deps.get(fk.sourceTableId)?.add(fk.targetTableId);
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const result: Table[] = [];
  let hasCycle = false;
  let cycleNames: string[] = [];

  function visit(id: string) {
    if (hasCycle || visited.has(id)) return;
    if (inStack.has(id)) {
      hasCycle = true;
      const cyclePath = [...inStack, id];
      const startIdx = cyclePath.indexOf(id);
      cycleNames = cyclePath
        .slice(startIdx)
        .map((cid) => tableById.get(cid)?.name ?? cid)
        .filter((n, i, arr) => arr.indexOf(n) === i);
      return;
    }
    inStack.add(id);
    for (const dep of deps.get(id) ?? []) visit(dep);
    inStack.delete(id);
    visited.add(id);
    const t = tableById.get(id);
    if (t) result.push(t);
  }

  for (const t of tables) visit(t.id);
  return { sorted: hasCycle ? [...tables] : result, hasCycle, cycleNames };
}

export function buildDrizzleSchema(tables: Table[], foreignKeys: ForeignKey[]): DrizzleResult {
  const warnings: string[] = [];

  const { sorted, hasCycle, cycleNames } = topoSort(tables, foreignKeys);
  if (hasCycle) {
    const nameList = cycleNames.length > 0 ? ` (${cycleNames.join(", ")})` : "";
    warnings.push(`Circular foreign key references detected${nameList} — table order may require manual adjustment`);
  }

  const tableById = new Map(tables.map((t) => [t.id, t]));

  // Build var names, detect duplicates
  const usedVarNames = new Map<string, string>(); // varName → first tableId
  const varName = new Map<string, string>();
  for (const t of sorted) {
    let v = toVarName(t.name);
    if (usedVarNames.has(v)) {
      warnings.push(`Variable name conflict: "${t.name}" and "${tableById.get(usedVarNames.get(v)!)?.name ?? ""}" both map to "${v}" — rename one table`);
      let suffix = 2;
      while (usedVarNames.has(`${v}_${suffix}`)) suffix++;
      v = `${v}_${suffix}`;
    }
    usedVarNames.set(v, t.id);
    varName.set(t.id, v);
  }

  const fksBySource = new Map<string, ForeignKey[]>();
  for (const fk of foreignKeys) {
    if (!fksBySource.has(fk.sourceTableId)) fksBySource.set(fk.sourceTableId, []);
    fksBySource.get(fk.sourceTableId)!.push(fk);
  }

  const pgCoreImports = new Set<string>(["pgTable"]);
  let needsSql = false;
  let needsArrayCallback = false;

  const tableBlocks: string[] = [];

  for (const table of sorted) {
    const tVar = varName.get(table.id)!;
    const tableFks = fksBySource.get(table.id) ?? [];

    const pkCols = table.columns.filter((c) => c.isPrimaryKey);
    const isCompositePk = pkCols.length > 1;

    // Column lines
    const colLines: string[] = [];
    for (const c of table.columns) {
      const { helper, options, isUnsupported } = pgTypeToDrizzle(c.type);
      if (isUnsupported) {
        warnings.push(`Unsupported type "${c.type}" on "${table.name}.${c.name}" — mapped to text`);
      }
      pgCoreImports.add(helper);

      const fieldName = toVarName(c.name);
      let expr = options ? `${helper}("${c.name}", ${options})` : `${helper}("${c.name}")`;

      if (!isCompositePk && c.isPrimaryKey) expr += ".primaryKey()";
      if (!c.isNullable) expr += ".notNull()";
      if (c.isUnique && !c.isPrimaryKey) expr += ".unique()";
      if (c.defaultValue) {
        const { expr: def, needsSql: ns } = formatDefault(c.defaultValue);
        if (ns) needsSql = true;
        expr += `.default(${def})`;
      }

      const fk = tableFks.find((f) => f.sourceColumnId === c.id);
      if (fk) {
        const target = tableById.get(fk.targetTableId);
        const targetCol = target?.columns.find((x) => x.id === fk.targetColumnId);
        if (target && targetCol) {
          const tVarTarget = varName.get(fk.targetTableId)!;
          const targetField = toVarName(targetCol.name);
          const actions: string[] = [];
          if (fk.onDelete !== "NO ACTION") {
            const mapped = FK_ACTION_MAP[fk.onDelete];
            if (mapped) {
              actions.push(`onDelete: "${mapped}"`);
            } else {
              warnings.push(`Unknown onDelete action "${fk.onDelete}" on FK from "${table.name}.${c.name}" — omitted`);
            }
          }
          if (fk.onUpdate !== "NO ACTION") {
            const mapped = FK_ACTION_MAP[fk.onUpdate];
            if (mapped) {
              actions.push(`onUpdate: "${mapped}"`);
            } else {
              warnings.push(`Unknown onUpdate action "${fk.onUpdate}" on FK from "${table.name}.${c.name}" — omitted`);
            }
          }
          const actStr = actions.length ? `, { ${actions.join(", ")} }` : "";
          expr += `.references(() => ${tVarTarget}.${targetField}${actStr})`;
        } else {
          warnings.push(`FK from "${table.name}.${c.name}" skipped: target not found`);
        }
      }

      colLines.push(`  ${fieldName}: ${expr},`);
    }

    // Table-level extras
    const extras: string[] = [];

    if (isCompositePk) {
      needsArrayCallback = true;
      pgCoreImports.add("primaryKey");
      const cols = pkCols.map((c) => `table.${toVarName(c.name)}`).join(", ");
      extras.push(`  primaryKey({ columns: [${cols}] }),`);
    }

    for (const idx of table.indexes) {
      const hasExpr =
        (idx.parts ?? []).some((p) => p.type === "expression") ||
        ((idx as any).expressions ?? []).length > 0;

      if (hasExpr) {
        warnings.push(`Expression index "${idx.name}" on "${table.name}" skipped — use raw SQL migration`);
        extras.push(`  // SKIPPED: expression index "${idx.name}"`);
        continue;
      }

      const idxCols = (idx.parts ?? [])
        .filter((p) => p.type === "column")
        .map((p) => {
          const c = table.columns.find((x) => x.id === p.value);
          return c ? `table.${toVarName(c.name)}` : null;
        })
        .filter(Boolean) as string[];

      if (idxCols.length === 0) {
        warnings.push(`Index "${idx.name}" on "${table.name}" skipped — no resolvable column references`);
        continue;
      }

      // Single-column uniqueIndex is redundant when the column already carries .unique()
      if (idx.type === "unique" && idxCols.length === 1) {
        const colId = (idx.parts ?? []).find((p) => p.type === "column")?.value;
        const c = table.columns.find((x) => x.id === colId);
        if (c?.isUnique && !c.isPrimaryKey) continue;
      }

      needsArrayCallback = true;
      const idxHelper = idx.type === "unique" ? "uniqueIndex" : "index";
      pgCoreImports.add(idxHelper);

      let idxExpr = `${idxHelper}("${idx.name}").on(${idxCols.join(", ")})`;
      if (idx.filter) {
        needsSql = true;
        idxExpr += `.where(sql\`${idx.filter}\`)`;
      }
      extras.push(`  ${idxExpr},`);
    }

    for (const ck of table.checkConstraints) {
      needsArrayCallback = true;
      pgCoreImports.add("check");
      needsSql = true;
      extras.push(`  check("${ck.name}", sql\`${ck.expression}\`),`);
    }

    const colBlock = colLines.join("\n");
    let block: string;
    if (extras.length > 0) {
      block = `export const ${tVar} = pgTable("${table.name}", {\n${colBlock}\n}, (table) => [\n${extras.join("\n")}\n]);`;
    } else {
      block = `export const ${tVar} = pgTable("${table.name}", {\n${colBlock}\n});`;
    }
    tableBlocks.push(block);
  }

  const sortedImports = [...pgCoreImports].sort();
  const importLine = `import { ${sortedImports.join(", ")} } from "drizzle-orm/pg-core";`;
  const sqlImportLine = needsSql ? `import { sql } from "drizzle-orm";` : "";

  const versionNote = needsArrayCallback
    ? "// Requires drizzle-orm >= 0.31.0 (array-style table callbacks)"
    : "";

  const headerLines = [
    "// Generated by SchemaViz — https://app.schemaviz.mystaline.dev",
    ...(versionNote ? [versionNote] : []),
  ];

  const parts = [
    ...headerLines,
    "",
    importLine,
    ...(sqlImportLine ? [sqlImportLine] : []),
    "",
    ...tableBlocks.map((b, i) => (i < tableBlocks.length - 1 ? b + "\n" : b)),
  ];

  return { schema: parts.join("\n"), warnings };
}
