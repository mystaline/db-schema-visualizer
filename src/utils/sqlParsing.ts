import type { Column } from "../stores/schemaStore";
import { uuid } from "./uuid";

/**
 * Low-level, stateless SQL-fragment parsing helpers shared by `ddlParser.ts`
 * (single-blob parsing) and `migrationFold.ts` (multi-file migration folding).
 * None of these know about an accumulator/table-map — they parse one string
 * fragment and return a plain result, leaving state mutation to the caller.
 */

/** Paren-depth-aware comma splitter — used for column/constraint lists inside `(...)`. */
export function splitByTopLevelComma(str: string): string[] {
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

/** Hand-parses a `DEFAULT ...` value out of a column-constraints substring. */
export function parseDefault(constraints: string): string | null {
  const kwMatch = constraints.match(/DEFAULT\s+/i);
  if (!kwMatch) return null;
  const s = constraints.slice(kwMatch.index! + kwMatch[0].length);
  if (!s) return null;

  let i = 0;

  if (s[0] === "'") {
    // Single-quoted string — read until closing quote, handling '' escapes
    i = 1;
    while (i < s.length) {
      if (s[i] === "'") {
        if (s[i + 1] === "'") {
          i += 2;
        } else {
          i++;
          break;
        }
      } else {
        i++;
      }
    }
  } else {
    // Unquoted token: track paren depth and embedded strings, stop at
    // whitespace or comma only when at depth 0 and outside a string
    let depth = 0;
    let inStr = false;
    while (i < s.length) {
      const c = s[i];
      if (inStr) {
        if (c === "'" && s[i + 1] === "'") {
          i += 2;
        } else if (c === "'") {
          inStr = false;
          i++;
        } else {
          i++;
        }
      } else {
        if (c === "'") {
          inStr = true;
          i++;
        } else if (c === "(") {
          depth++;
          i++;
        } else if (c === ")") {
          if (depth === 0) break;
          depth--;
          i++;
        } else if (
          depth === 0 &&
          (c === "," || c === " " || c === "\t" || c === "\n" || c === "\r")
        )
          break;
        else {
          i++;
        }
      }
    }
  }

  const result = s.slice(0, i);
  return result || null;
}

/** Parses `ON DELETE|UPDATE (CASCADE|SET NULL|RESTRICT|NO ACTION)` out of an FK suffix. */
export function parseAction(
  suffix: string,
  type: "DELETE" | "UPDATE",
): "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION" {
  const regex = new RegExp(
    `ON\\s+${type}\\s+(CASCADE|SET\\s+NULL|RESTRICT|NO\\s+ACTION)`,
    "i",
  );
  const match = suffix.match(regex);
  if (match) {
    const action = match[1].toUpperCase().replace(/\s+/g, " ");
    return action as "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  }
  return "NO ACTION";
}

export interface InlineFKReference {
  targetTableName: string;
  targetColName: string;
  suffix: string;
}

export interface ParsedColumnLine {
  column: Column;
  inlineReference?: InlineFKReference;
}

/** Parses one column-definition line from inside a `CREATE TABLE (...)`/`ADD COLUMN` body. */
export function parseColumnLine(line: string): ParsedColumnLine | null {
  const nameMatch = line.match(/^"([^"]+)"|^`([^`]+)`|^\s*([a-zA-Z0-9_]+)/);
  if (!nameMatch) return null;

  const colName = nameMatch[1] || nameMatch[2] || nameMatch[3];
  const remaining = line.slice(nameMatch[0].length).trim();

  // Type is everything before the first constraint keyword; the rest is constraints.
  const constraintKeywords = [
    "NOT\\s+NULL",
    "NULL",
    "PRIMARY\\s+KEY",
    "UNIQUE",
    "DEFAULT",
    "REFERENCES",
    "CHECK",
    "CONSTRAINT",
  ];
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

  const column: Column = {
    id: uuid(),
    name: colName,
    type: type.toLowerCase() || "text",
    isPrimaryKey: /PRIMARY\s+KEY/i.test(constraints),
    isNullable: !/NOT\s+NULL/i.test(constraints),
    isUnique: /UNIQUE/i.test(constraints),
    defaultValue: parseDefault(constraints),
  };

  let inlineReference: InlineFKReference | undefined;
  const colRefMatch = constraints.match(
    /REFERENCES\s+(?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_.]+))\s*\((?:"([^"]+)"|`([^`]+)`|([a-zA-Z0-9_]+))\)/i,
  );
  if (colRefMatch) {
    inlineReference = {
      targetTableName: colRefMatch[1] || colRefMatch[2] || colRefMatch[3],
      targetColName: colRefMatch[4] || colRefMatch[5] || colRefMatch[6],
      suffix: constraints.slice((colRefMatch.index ?? 0) + colRefMatch[0].length),
    };
  }

  return { column, inlineReference };
}

export interface ParsedCheckConstraint {
  name?: string; // undefined => caller should auto-name
  expression: string;
}

/** Parses `[CONSTRAINT name] CHECK (...)` from a table-level constraint line. */
export function parseCheckConstraintLine(line: string): ParsedCheckConstraint | null {
  const namedMatch = line.match(/^CONSTRAINT\s+([a-zA-Z0-9_"]+)\s+CHECK\s*\((.*)\)/i);
  if (namedMatch) {
    return { name: namedMatch[1].replace(/"/g, ""), expression: namedMatch[2].trim() };
  }
  const bareMatch = line.match(/^CHECK\s*\((.*)\)/i);
  if (bareMatch) {
    return { expression: bareMatch[1].trim() };
  }
  return null;
}

/** Matches a quoted/backtick/bare identifier at the start of a string, e.g. table/column names. */
export const IDENTIFIER = `(?:"([^"]+)"|` + "`([^`]+)`" + `|([a-zA-Z0-9_.]+))`;
