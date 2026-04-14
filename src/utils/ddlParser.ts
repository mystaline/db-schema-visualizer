import type { Table, ForeignKey, Column } from "../stores/schemaStore";

interface ParsedSchema {
  tables: Table[];
  foreignKeys: ForeignKey[];
}

export function parseDDL(sql: string): ParsedSchema {
  const tables: Table[] = [];
  const foreignKeys: ForeignKey[] = [];

  // Clean up: remove SQL comments and trim
  const cleanSql = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  // Split by semicolon, but handle potential semicolons in strings or expressions (simplistic approach)
  // For most DDL, statements end with a semicolon at the top level
  const statements = cleanSql.split(";").map(s => s.trim()).filter(Boolean);

  const tableMap = new Map<string, Table>();
  const tableIdToName = new Map<string, string>();
  const colNameToIdMap = new Map<string, Map<string, string>>(); // tableName -> colName -> colId

  for (const statement of statements) {
    // 1. CREATE TABLE
    const createTableMatch = statement.match(/CREATE\s+TABLE\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))\s*\(([\s\S]*)\)/i);
    if (createTableMatch) {
      const originalTableName = createTableMatch[1] || createTableMatch[2];
      const body = createTableMatch[3];
      
      const tableId = crypto.randomUUID();
      const table: Table = {
        id: tableId,
        name: originalTableName,
        x: 0, // Will layout later
        y: 0,
        columns: [],
        indexes: [],
        checkConstraints: [],
      };
      
      tableMap.set(originalTableName, table);
      tableIdToName.set(tableId, originalTableName);
      colNameToIdMap.set(originalTableName, new Map());

      const lines = splitByTopLevelComma(body);
      
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Table level PK
        const pkMatch = line.match(/^PRIMARY\s+KEY\s*\((.*)\)/i);
        if (pkMatch) {
          const pkCols = pkMatch[1].split(",").map(c => c.trim().replace(/"/g, ""));
          pkCols.forEach(colName => {
            const col = table.columns.find(c => c.name === colName);
            if (col) col.isPrimaryKey = true;
          });
          continue;
        }

        // Table level Check Constraint
        const checkMatch = line.match(/^CONSTRAINT\s+([a-zA-Z0-9_"]+)\s+CHECK\s*\((.*)\)/i) || 
                          line.match(/^CHECK\s*\((.*)\)/i);
        if (checkMatch) {
          const name = checkMatch.length === 3 ? checkMatch[1].replace(/"/g, "") : `chk_${originalTableName}_${table.checkConstraints.length + 1}`;
          const expr = checkMatch.length === 3 ? checkMatch[2] : checkMatch[1];
          table.checkConstraints.push({
            id: crypto.randomUUID(),
            name,
            expression: expr.trim()
          });
          continue;
        }

        // Column definition
        // Extract name (handle quotes)
        const nameMatch = line.match(/^"([^"]+)"|^\s*([a-zA-Z0-9_]+)/);
        if (nameMatch) {
          const colName = nameMatch[1] || nameMatch[2];
          const remaining = line.slice(nameMatch[0].length).trim();
          
          // Separate type and constraints
          // Type is everything until the first constraint keyword or end of line
          // Keywords: NOT NULL, NULL, PRIMARY KEY, UNIQUE, DEFAULT, REFERENCES, CHECK, CONSTRAINT
          const constraintKeywords = ["NOT\\s+NULL", "NULL", "PRIMARY\\s+KEY", "UNIQUE", "DEFAULT", "REFERENCES", "CHECK", "CONSTRAINT"];
          const keywordRegex = new RegExp(`\\b(${constraintKeywords.join("|")})\\b`, "i");
          
          const keywordMatch = remaining.match(keywordRegex);
          let type = "";
          let constraints = "";
          
          if (keywordMatch) {
            type = remaining.slice(0, keywordMatch.index).trim();
            constraints = remaining.slice(keywordMatch.index).trim();
          } else {
            type = remaining;
          }

          const colId = crypto.randomUUID();
          const column: Column = {
            id: colId,
            name: colName,
            type: type.toLowerCase() || "text",
            isPrimaryKey: /PRIMARY\s+KEY/i.test(constraints),
            isNullable: !/NOT\s+NULL/i.test(constraints),
            isUnique: /UNIQUE/i.test(constraints),
            defaultValue: parseDefault(constraints),
          };
          
          table.columns.push(column);
          colNameToIdMap.get(originalTableName)?.set(colName, colId);
        }
      }
      tables.push(table);
      continue;
    }

    // 2. ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY
    const fkMatch = statement.match(/ALTER\s+TABLE\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))\s+ADD\s+CONSTRAINT\s+(?:"[^"]+"|([a-zA-Z0-9_]+))\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))\s*\(([^)]+)\)(.*)/i);
    if (fkMatch) {
      const sourceTableName = fkMatch[1] || fkMatch[2];
      const sourceColNames = fkMatch[4].split(",").map(c => c.trim().replace(/"/g, ""));
      const targetTableName = fkMatch[5] || fkMatch[6];
      const targetColNames = fkMatch[7].split(",").map(c => c.trim().replace(/"/g, ""));
      const suffix = fkMatch[8] || "";

      const sourceTable = tableMap.get(sourceTableName);
      const targetTable = tableMap.get(targetTableName);

      if (sourceTable && targetTable) {
        // Current system only supports single-column FKs
        // We'll take the first one or create multiple if it makes sense (but interface is 1-1)
        sourceColNames.forEach((sColName, idx) => {
          const tColName = targetColNames[idx];
          const sColId = colNameToIdMap.get(sourceTableName)?.get(sColName);
          const tColId = colNameToIdMap.get(targetTableName)?.get(tColName);

          if (sColId && tColId) {
            foreignKeys.push({
              id: crypto.randomUUID(),
              sourceTableId: sourceTable.id,
              sourceColumnId: sColId,
              targetTableId: targetTable.id,
              targetColumnId: tColId,
              onDelete: parseAction(suffix, "DELETE"),
              onUpdate: parseAction(suffix, "UPDATE"),
            });
          }
        });
      }
      continue;
    }

    // 3. CREATE INDEX
    const indexMatch = statement.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))\s+ON\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))\s*\((.*)\)(.*)/i);
    if (indexMatch) {
      const isUnique = !!indexMatch[1];
      const indexName = indexMatch[2] || indexMatch[3];
      const tableName = indexMatch[4] || indexMatch[5];
      const partsStr = indexMatch[6];
      const suffix = indexMatch[7] || "";

      const table = tableMap.get(tableName);
      if (table) {
        const parts = splitByTopLevelComma(partsStr).map(p => {
          const orderMatch = p.match(/(.*)\s+(ASC|DESC)$/i);
          const order = (orderMatch?.[2].toUpperCase() as "ASC" | "DESC") || "ASC";
          const val = orderMatch ? orderMatch[1].trim() : p.trim();
          
          // Is it a column name or an expression?
          // Simplistic: if it's alphanumeric, try to find the column ID
          const cleanVal = val.replace(/"/g, "");
          const colId = colNameToIdMap.get(tableName)?.get(cleanVal);
          
          if (colId) {
            return { type: "column" as const, value: colId, order };
          } else {
            // Expression (remove outer parens if present)
            const expr = val.startsWith("(") && val.endsWith(")") ? val.slice(1, -1) : val;
            return { type: "expression" as const, value: expr, order };
          }
        });

        const filterMatch = suffix.match(/WHERE\s+(.*)/i);
        
        table.indexes.push({
          id: crypto.randomUUID(),
          name: indexName,
          type: isUnique ? "unique" : "normal",
          parts,
          filter: filterMatch?.[1].trim()
        });
      }
    }
  }

  return { tables, foreignKeys };
}

function splitByTopLevelComma(str: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseDefault(constraints: string): string | null {
  const match = constraints.match(/DEFAULT\s+([^, ]+)/i);
  if (match) return match[1];
  return null;
}

function parseAction(suffix: string, type: "DELETE" | "UPDATE"): "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION" {
  const regex = new RegExp(`ON\\s+${type}\\s+(CASCADE|SET\\s+NULL|RESTRICT|NO\\s+ACTION)`, "i");
  const match = suffix.match(regex);
  if (match) {
    const action = match[1].toUpperCase().replace(/\s+/g, " ");
    return action as "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  }
  return "NO ACTION";
}
