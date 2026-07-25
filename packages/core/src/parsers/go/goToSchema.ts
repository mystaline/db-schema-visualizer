import type { SchemaTable, Column, ForeignKey } from "../../types";
import { uuid } from "../../uuid";
import { goTypeToPg } from "../../generators/shared/pgTypeMap";
import { toSnakeCase, pluralize } from "../../generators/shared/naming";

export interface GoParseResult {
  tables: SchemaTable[];
  foreignKeys: ForeignKey[]; // always empty — Go struct tags carry no FK concept
  warnings: string[];
}

const KNOWN_GO_SCALARS = new Set([
  "string",
  "bool",
  "int",
  "int8",
  "int16",
  "int32",
  "int64",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "float32",
  "float64",
  "byte",
  "rune",
  "time.Time",
  "json.RawMessage",
  "interface{}",
]);

function extractTagValue(tagStr: string | undefined): string | null {
  if (!tagStr) return null;
  const dbMatch = tagStr.match(/\bdb:"([^"]*)"/);
  if (dbMatch && dbMatch[1]) return dbMatch[1];
  const jsonMatch = tagStr.match(/\bjson:"([^"]*)"/);
  if (jsonMatch) {
    const value = jsonMatch[1].split(",")[0];
    if (value && value !== "-") return value;
  }
  return null;
}

/**
 * Hand-rolled regex parser for Go struct source, matching the house style of
 * ddlParser.ts. See packages/core README for the full list of unsupported
 * constructs (embedded structs, non-json/db tags, pointer-to-struct and
 * slice-of-struct fields, methods/interfaces) — each produces a warning and
 * a safe fallback rather than a crash.
 */
export function parseGoStructs(source: string): GoParseResult {
  const warnings: string[] = [];
  const tables: SchemaTable[] = [];

  const cleaned = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  const structRegex = /type\s+(\w+)\s+struct\s*\{([\s\S]*?)\n\}/g;
  let match: RegExpExecArray | null;

  while ((match = structRegex.exec(cleaned))) {
    const structName = match[1];
    const body = match[2];
    const tableName = toSnakeCase(pluralize(structName));

    const columns: Column[] = [];
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const embeddedMatch = line.match(/^\*?[\w.]+$/);
      if (embeddedMatch) {
        warnings.push(`Struct "${structName}": embedded field "${line}" is not supported — skipped`);
        continue;
      }

      const fieldMatch = line.match(/^(\w+)\s+(\*?[\w.[\]]+)\s*(?:`([^`]*)`)?\s*$/);
      if (!fieldMatch) {
        warnings.push(`Struct "${structName}": could not parse field line "${line}" — skipped`);
        continue;
      }
      const [, fieldName, rawType, tagStr] = fieldMatch;
      const isPointer = rawType.startsWith("*");
      const baseType = rawType.replace(/^\*/, "");

      if (baseType.startsWith("[]") && baseType !== "[]byte") {
        warnings.push(
          `Field "${fieldName}" on struct "${structName}": slice-of-struct fields are not supported (no nested table extraction) — skipped`,
        );
        continue;
      }

      if (!KNOWN_GO_SCALARS.has(baseType) && baseType !== "[]byte" && /^[A-Z]/.test(baseType)) {
        warnings.push(
          `Field "${fieldName}" on struct "${structName}": pointer-to-struct / relation fields are not supported (no FK inference from Go) — skipped`,
        );
        continue;
      }

      const { pgType, isUnsupported } = goTypeToPg(baseType);
      if (isUnsupported) {
        warnings.push(
          `Field "${fieldName}" on struct "${structName}": unrecognized Go type "${rawType}" — mapped to ${pgType}`,
        );
      }

      const tagValue = extractTagValue(tagStr);
      const columnName = tagValue ?? toSnakeCase(fieldName);
      const isPrimaryKey = columnName.toLowerCase() === "id";

      columns.push({
        id: uuid(),
        name: columnName,
        type: pgType,
        isPrimaryKey,
        isNullable: isPointer,
        isUnique: isPrimaryKey,
        defaultValue: null,
      });
    }

    tables.push({
      id: uuid(),
      name: tableName,
      columns,
      indexes: [],
      checkConstraints: [],
    });
  }

  return { tables, foreignKeys: [], warnings };
}
