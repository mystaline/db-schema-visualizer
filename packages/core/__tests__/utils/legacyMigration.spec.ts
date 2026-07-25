import { describe, it, expect } from "vitest";
import { migrateLegacyIndexes, normalizeImportedTable } from "../../src/utils/legacyMigration";
import type { SchemaTable } from "../../src/types";

describe("migrateLegacyIndexes", () => {
  it("converts legacy columnIds/expressions into parts", () => {
    const result = migrateLegacyIndexes([
      { id: "i1", name: "idx_a", type: "normal", columnIds: ["c1", "c2"], expressions: ["lower(x)"] } as any,
    ]);
    expect(result[0].parts).toEqual([
      { type: "column", value: "c1", order: "ASC" },
      { type: "column", value: "c2", order: "ASC" },
      { type: "expression", value: "lower(x)", order: "ASC" },
    ]);
  });

  it("leaves indexes that already have parts unchanged", () => {
    const idx = { id: "i1", name: "idx_a", type: "normal" as const, parts: [{ type: "column" as const, value: "c1", order: "ASC" as const }] };
    const result = migrateLegacyIndexes([idx]);
    expect(result[0]).toBe(idx);
  });

  it("returns an empty array for undefined input", () => {
    expect(migrateLegacyIndexes(undefined)).toEqual([]);
  });
});

describe("normalizeImportedTable", () => {
  it("migrates legacy indexes and defaults missing checkConstraints", () => {
    const table = {
      id: "t1",
      name: "users",
      columns: [],
      indexes: [{ id: "i1", name: "idx_a", type: "normal", columnIds: ["c1"] } as any],
    } as unknown as SchemaTable;
    const result = normalizeImportedTable(table);
    expect(result.checkConstraints).toEqual([]);
    expect(result.indexes[0].parts).toEqual([{ type: "column", value: "c1", order: "ASC" }]);
  });

  it("preserves extra fields on subtypes (e.g. the web app's x/y)", () => {
    interface AppTable extends SchemaTable {
      x: number;
      y: number;
    }
    const table: AppTable = { id: "t1", name: "users", x: 10, y: 20, columns: [], indexes: [], checkConstraints: [] };
    const result = normalizeImportedTable(table);
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
  });
});
