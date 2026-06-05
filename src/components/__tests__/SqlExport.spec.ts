import { describe, it, expect } from "vitest";
import { buildSchemaSql } from "../../utils/sqlExporter";
import type { Table, ForeignKey } from "../../stores/schemaStore";

const mkTable = (overrides: Partial<Table> = {}): Table => ({
  id: "t1",
  name: "users",
  x: 0,
  y: 0,
  columns: [],
  indexes: [],
  checkConstraints: [],
  ...overrides,
});

describe("sqlExporter — high-level scenarios (was SqlExport.spec.ts)", () => {
  it("generates SQL with table notes, PK, NOT NULL/DEFAULT, named CHECK constraint", () => {
    const table = mkTable({
      id: "oi", name: "order_items", notes: "Stores items for each order",
      columns: [
        { id: "c1", name: "order_id", type: "int", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
        { id: "c2", name: "product_id", type: "int", isPrimaryKey: true, isNullable: false, isUnique: false, defaultValue: null },
        { id: "c3", name: "quantity", type: "int", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "1" },
      ],
      checkConstraints: [{ id: "k1", name: "chk_min_qty", expression: "quantity > 0" }],
    });

    const sql = buildSchemaSql([table], [], {
      exportSet: new Set(["oi"]),
      markCrossBoundary: false,
    });

    expect(sql).toContain("-- Stores items for each order");
    expect(sql).toContain(`PRIMARY KEY ("product_id")`);
    expect(sql).toContain(`"quantity" int NOT NULL DEFAULT 1`);
    expect(sql).toContain("CONSTRAINT chk_min_qty CHECK (quantity > 0)");
  });

  it("generates complex unique index with expression part and WHERE filter", () => {
    const table = mkTable({
      id: "u", name: "users",
      columns: [
        { id: "ec", name: "email", type: "varchar(255)", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
      indexes: [{
        id: "i1", name: "idx_unique_email", type: "unique",
        parts: [
          { type: "column", value: "ec", order: "ASC" },
          { type: "expression", value: "lower(email)", order: "ASC" },
        ],
        filter: "deleted_at IS NULL",
      }],
    });
    const sql = buildSchemaSql([table], [], {
      exportSet: new Set(["u"]), markCrossBoundary: false,
    });
    expect(sql).toContain(`CREATE UNIQUE INDEX "idx_unique_email" ON "users" ("email", lower(email)) WHERE deleted_at IS NULL`);
  });

  it("generates ALTER TABLE ADD CONSTRAINT for a FK between two tables", () => {
    const sites = mkTable({ id: "s", name: "sites",
      columns: [{ id: "sc", name: "id", type: "int", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const users = mkTable({ id: "u", name: "users",
      columns: [{ id: "uc", name: "site_id", type: "int", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null }],
    });
    const fk: ForeignKey = {
      id: "f", sourceTableId: "u", sourceColumnId: "uc",
      targetTableId: "s", targetColumnId: "sc",
      onDelete: "CASCADE", onUpdate: "CASCADE",
    };
    const sql = buildSchemaSql([sites, users], [fk], {
      exportSet: new Set(["s", "u"]), markCrossBoundary: false,
    });
    expect(sql).toContain(`ALTER TABLE "users"`);
    expect(sql).toContain(`FOREIGN KEY ("site_id") REFERENCES "sites" ("id")`);
  });
});
