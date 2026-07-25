import { describe, it, expect } from "vitest";
import { buildTsInterfaces } from "../../src/generators/ts/tsGenerator";
import { parseTsInterfaces } from "../../src/parsers/ts/tsToSchema";
import { sampleSchema } from "../fixtures/sampleSchema";

describe("round-trip: schema -> TS -> schema", () => {
  const { code } = buildTsInterfaces(sampleSchema.tables, sampleSchema.foreignKeys);
  const { tables: roundTripped, foreignKeys: roundTrippedFks, warnings } = parseTsInterfaces(code);

  it("produces no parse warnings for generator-emitted code", () => {
    expect(warnings).toEqual([]);
  });

  it("round-trips table names exactly (interface <-> table naming strategies are inverse)", () => {
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

  it("drops foreign keys entirely (TS interfaces have no native FK concept)", () => {
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

  it("preserves type category but not the exact Postgres type string (e.g. varchar(255) -> string/text-ish)", () => {
    const users = roundTripped.find((t) => t.name === "users")!;
    const email = users.columns.find((c) => c.name === "email")!;
    expect(email.type).toBe("text"); // originally varchar(255) -> TS `string` -> text
  });

  it("does not round-trip timestamptz exactly (TS wire format is a plain ISO string)", () => {
    const users = roundTripped.find((t) => t.name === "users")!;
    const createdAt = users.columns.find((c) => c.name === "created_at")!;
    expect(createdAt.type).toBe("text"); // TS `string` has no way to distinguish this from plain text
  });

  it("round-trips boolean exactly", () => {
    const users = roundTripped.find((t) => t.name === "users")!;
    expect(users.columns.find((c) => c.name === "is_active")!.type).toBe("boolean");
  });

  it("collapses all number-family columns to numeric (TS `number` does not distinguish int/bigint/float)", () => {
    const users = roundTripped.find((t) => t.name === "users")!;
    expect(users.columns.find((c) => c.name === "age")!.type).toBe("numeric");

    const posts = roundTripped.find((t) => t.name === "posts")!;
    expect(posts.columns.find((c) => c.name === "view_count")!.type).toBe("numeric"); // originally bigint
    expect(posts.columns.find((c) => c.name === "price")!.type).toBe("numeric"); // originally numeric(10,2)
  });

  it("round-trips jsonb exactly (unknown is pgTypeToTs's dedicated json/jsonb marker)", () => {
    const posts = roundTripped.find((t) => t.name === "posts")!;
    expect(posts.columns.find((c) => c.name === "metadata")!.type).toBe("jsonb");
  });
});
