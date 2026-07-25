import ts from "typescript";
import type { SchemaTable, Column, ForeignKey } from "../../types";
import { uuid } from "../../uuid";
import { tsTypeToPg } from "../../generators/shared/pgTypeMap";
import { toSnakeCase, pluralize } from "../../generators/shared/naming";

export interface TsParseResult {
  tables: SchemaTable[];
  foreignKeys: ForeignKey[]; // always empty — TS interfaces carry no FK concept
  warnings: string[];
}

interface ResolvedType {
  pgType: string;
  isNullable: boolean;
  isUnsupported?: boolean;
  reason?: string;
}

function resolveType(
  typeNode: ts.TypeNode,
  interfaceName: string,
  fieldName: string,
): ResolvedType {
  if (ts.isUnionTypeNode(typeNode)) {
    let isNullable = false;
    const nonNullTypes: ts.TypeNode[] = [];
    for (const member of typeNode.types) {
      const isNullLiteral = ts.isLiteralTypeNode(member) && member.literal.kind === ts.SyntaxKind.NullKeyword;
      if (isNullLiteral || member.kind === ts.SyntaxKind.UndefinedKeyword) {
        isNullable = true;
      } else {
        nonNullTypes.push(member);
      }
    }
    if (nonNullTypes.length === 1) {
      const resolved = resolveType(nonNullTypes[0], interfaceName, fieldName);
      return { ...resolved, isNullable: isNullable || resolved.isNullable };
    }
    return {
      pgType: "text",
      isNullable,
      isUnsupported: true,
      reason: `Interface "${interfaceName}.${fieldName}": multi-member/enum-like union type is not supported — mapped to text`,
    };
  }

  if (ts.isTypeReferenceNode(typeNode)) {
    const refName = typeNode.typeName.getText();
    if (refName === "Date") return { pgType: "timestamp", isNullable: false };
    return {
      pgType: "text",
      isNullable: false,
      isUnsupported: true,
      reason: `Interface "${interfaceName}.${fieldName}": referenced/generic type "${refName}" is not supported — mapped to text`,
    };
  }

  if (ts.isArrayTypeNode(typeNode)) {
    return {
      pgType: "text",
      isNullable: false,
      isUnsupported: true,
      reason: `Interface "${interfaceName}.${fieldName}": array types are approximated — mapped to text`,
    };
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    return {
      pgType: "text",
      isNullable: false,
      isUnsupported: true,
      reason: `Interface "${interfaceName}.${fieldName}": nested object type literals are not supported — mapped to text`,
    };
  }

  if (ts.isLiteralTypeNode(typeNode)) {
    return {
      pgType: "text",
      isNullable: false,
      isUnsupported: true,
      reason: `Interface "${interfaceName}.${fieldName}": literal type is not supported — mapped to text`,
    };
  }

  const keywordText = typeNode.getText();
  const { pgType, isUnsupported } = tsTypeToPg(keywordText);
  if (isUnsupported) {
    return {
      pgType,
      isNullable: false,
      isUnsupported: true,
      reason: `Interface "${interfaceName}.${fieldName}": unrecognized type "${keywordText}" — mapped to ${pgType}`,
    };
  }
  return { pgType, isNullable: false };
}

function makeColumn(fieldName: string, pgType: string, isNullable: boolean): Column {
  const columnName = toSnakeCase(fieldName);
  const isPrimaryKey = columnName.toLowerCase() === "id";
  return {
    id: uuid(),
    name: columnName,
    type: pgType,
    isPrimaryKey,
    isNullable,
    isUnique: isPrimaryKey,
    defaultValue: null,
  };
}

/**
 * Parses TS interface source (via the TS Compiler API) into a schema. See
 * packages/core README for the full list of unsupported constructs
 * (generics, mapped/intersection types, extends chains, method/call/index
 * signatures, nested object literals, enum-like string unions) — each
 * produces a warning and a safe `text`/`unknown` fallback, never a crash.
 */
export function parseTsInterfaces(source: string): TsParseResult {
  const warnings: string[] = [];
  const tables: SchemaTable[] = [];

  const sourceFile = ts.createSourceFile("input.ts", source, ts.ScriptTarget.Latest, true);

  for (const statement of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement)) continue;

    const interfaceName = statement.name.text;
    // Mirrors the generator's structNameStrategy default (PascalCase(singularize(tableName))) in reverse,
    // consistent with the Go parser's table-name derivation.
    const tableName = toSnakeCase(pluralize(interfaceName));

    if (statement.heritageClauses && statement.heritageClauses.length > 0) {
      warnings.push(
        `Interface "${interfaceName}": extends/heritage clauses are not supported — only own members are read`,
      );
    }

    const columns: Column[] = [];

    for (const member of statement.members) {
      if (!ts.isPropertySignature(member)) {
        if (
          ts.isMethodSignature(member) ||
          ts.isCallSignatureDeclaration(member) ||
          ts.isConstructSignatureDeclaration(member)
        ) {
          warnings.push(`Interface "${interfaceName}": method/call signatures are not supported — skipped`);
        } else if (ts.isIndexSignatureDeclaration(member)) {
          warnings.push(`Interface "${interfaceName}": index signatures are not supported — skipped`);
        } else {
          warnings.push(`Interface "${interfaceName}": unsupported member skipped`);
        }
        continue;
      }

      if (!member.name || !ts.isIdentifier(member.name)) {
        warnings.push(`Interface "${interfaceName}": could not determine a property name — skipped`);
        continue;
      }

      const fieldName = member.name.text;
      const isOptional = !!member.questionToken;

      if (!member.type) {
        warnings.push(`Interface "${interfaceName}.${fieldName}": missing type annotation — mapped to text`);
        columns.push(makeColumn(fieldName, "text", true));
        continue;
      }

      const resolved = resolveType(member.type, interfaceName, fieldName);
      if (resolved.reason) warnings.push(resolved.reason);
      columns.push(makeColumn(fieldName, resolved.pgType, isOptional || resolved.isNullable));
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
