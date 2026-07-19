import { foldMigrationHistory, type ParsedSchema } from "./migrationFold";

export type { ParsedSchema };
export {
  splitByTopLevelComma,
  parseDefault,
  parseAction,
  parseColumnLine,
  parseCheckConstraintLine,
} from "./sqlParsing";

/**
 * Parses a single SQL blob into a schema snapshot. Thin wrapper around
 * `foldMigrationHistory` called with exactly one file — there is one
 * statement-handling code path shared with multi-file migration folding,
 * not two that could drift apart.
 */
export function parseDDL(sql: string): ParsedSchema {
  return foldMigrationHistory([{ version: "0", sql }]).snapshot;
}
