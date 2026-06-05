import { describe, it, expect } from "vitest";
import { PRESET_REGISTRY, buildPreset, type PresetKey } from "../presets/index";

const ALL_KEYS: PresetKey[] = [
  "blog",
  "ecommerce",
  "saas",
  "rbac",
  "social",
  "cms",
  "chat",
];

describe("PRESET_REGISTRY", () => {
  it("contains all expected preset keys", () => {
    const keys = PRESET_REGISTRY.map((p) => p.key);
    for (const k of ALL_KEYS) {
      expect(keys).toContain(k);
    }
  });

  it("every entry has a non-empty label and description", () => {
    for (const entry of PRESET_REGISTRY) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("buildPreset", () => {
  for (const key of ALL_KEYS) {
    describe(`"${key}" preset`, () => {
      it("returns at least 3 tables", () => {
        const { tables } = buildPreset(key);
        expect(tables.length).toBeGreaterThanOrEqual(3);
      });

      it("every table has a unique id", () => {
        const { tables } = buildPreset(key);
        const ids = tables.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("every table has at least one primary key column", () => {
        const { tables } = buildPreset(key);
        for (const table of tables) {
          const hasPk = table.columns.some((c) => c.isPrimaryKey);
          expect(hasPk, `table "${table.name}" has no PK`).toBe(true);
        }
      });

      it("all column ids are unique within the preset", () => {
        const { tables } = buildPreset(key);
        const colIds = tables.flatMap((t) => t.columns.map((c) => c.id));
        expect(new Set(colIds).size).toBe(colIds.length);
      });

      it("all index parts reference existing columns (no blank ids)", () => {
        const { tables } = buildPreset(key);
        const colById = new Map(
          tables.flatMap((t) => t.columns.map((c) => [c.id, c])),
        );
        for (const table of tables) {
          for (const idx of table.indexes ?? []) {
            for (const part of idx.parts ?? []) {
              if (part.type === "column") {
                expect(
                  part.value.length,
                  `index "${idx.name}" on "${table.name}" has a blank column id`,
                ).toBeGreaterThan(0);
                expect(
                  colById.has(part.value),
                  `index "${idx.name}" on "${table.name}" references unknown column id "${part.value}"`,
                ).toBe(true);
              }
            }
          }
        }
      });

      it("all foreign key references point to existing tables and columns", () => {
        const { tables, foreignKeys } = buildPreset(key);
        const tableIds = new Set(tables.map((t) => t.id));
        const colById = new Map(
          tables.flatMap((t) => t.columns.map((c) => [c.id, c])),
        );
        for (const fk of foreignKeys) {
          expect(
            tableIds.has(fk.sourceTableId),
            `FK sourceTableId ${fk.sourceTableId} not found`,
          ).toBe(true);
          expect(
            tableIds.has(fk.targetTableId),
            `FK targetTableId ${fk.targetTableId} not found`,
          ).toBe(true);
          expect(
            colById.has(fk.sourceColumnId),
            `FK sourceColumnId ${fk.sourceColumnId} not found`,
          ).toBe(true);
          expect(
            colById.has(fk.targetColumnId),
            `FK targetColumnId ${fk.targetColumnId} not found`,
          ).toBe(true);
        }
      });
    });
  }
});
