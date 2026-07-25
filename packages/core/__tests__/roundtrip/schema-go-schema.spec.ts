import { describe, it, expect } from "vitest";
import { buildGoStructs } from "../../src/generators/go/goGenerator";
import { parseGoStructs } from "../../src/parsers/go/goToSchema";
import { sampleSchema } from "../fixtures/sampleSchema";

describe("round-trip: schema -> Go -> schema", () => {
  const { code } = buildGoStructs(sampleSchema.tables, sampleSchema.foreignKeys);
  const { tables: roundTripped, foreignKeys: roundTrippedFks, warnings } = parseGoStructs(code);

  it("produces no parse warnings for generator-emitted code", () => {
    expect(warnings).toEqual([]);
  });

  it("round-trips table names exactly (struct <-> table naming strategies are inverse)", () => {
    expect(roundTripped.map((t) => t.name).sort()).toEqual(
      sampleSchema.tables.map((t) => t.name).sort(),
    );
  });

  it("round-trips column names, primary-key flags, and nullability exactly", () => {
    for (const original of sampleSchema.tables) {
      const rt = roundTripped.find((t) => t.name === original.name)!;
      expect(rt).toBeDefined();
      expect(rt.columns.map((c) => c.name).sort()).toEqual(
        original.columns.map((c) => c.name).sort(),
      );
      for (const origCol of original.columns) {
        const rtCol = rt.columns.find((c) => c.name === origCol.name)!;
        expect(rtCol.isPrimaryKey).toBe(origCol.isPrimaryKey);
        expect(rtCol.isNullable).toBe(origCol.isNullable);
      }
    }
  });

  it("drops foreign keys entirely (Go has no native FK concept)", () => {
    expect(roundTrippedFks).toEqual([]);
  });

  it("drops indexes, check constraints, default values, and non-PK uniqueness", () => {
    for (const table of roundTripped) {
      expect(table.indexes).toEqual([]);
      expect(table.checkConstraints).toEqual([]);
      for (const col of table.columns) {
        expect(col.defaultValue).toBeNull();
        if (!col.isPrimaryKey) expect(col.isUnique).toBe(false);
      }
    }
  });

  it("preserves type category but not the exact Postgres type string (e.g. varchar(255) -> text)", () => {
    const users = roundTripped.find((t) => t.name === "users")!;
    const email = users.columns.find((c) => c.name === "email")!;
    expect(email.type).toBe("text"); // originally varchar(255)

    const posts = roundTripped.find((t) => t.name === "posts")!;
    const price = posts.columns.find((c) => c.name === "price")!;
    expect(price.type).toBe("text"); // originally numeric(10,2) — Go generator maps to string
  });

  it("round-trips int/bool/jsonb type categories exactly (no lossy conversion for these)", () => {
    const users = roundTripped.find((t) => t.name === "users")!;
    expect(users.columns.find((c) => c.name === "age")!.type).toBe("integer");
    expect(users.columns.find((c) => c.name === "is_active")!.type).toBe("boolean");

    const posts = roundTripped.find((t) => t.name === "posts")!;
    expect(posts.columns.find((c) => c.name === "view_count")!.type).toBe("bigint");
    expect(posts.columns.find((c) => c.name === "metadata")!.type).toBe("jsonb");
  });
});
