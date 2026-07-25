import { describe, it, expect } from "vitest";
import { buildGoStructs } from "../../../src/generators/go/goGenerator";
import type { SchemaTable, ForeignKey } from "../../../src/types";

const mkTable = (overrides: Partial<SchemaTable> = {}): SchemaTable => ({
  id: "t1",
  name: "users",
  columns: [],
  indexes: [],
  checkConstraints: [],
  ...overrides,
});

describe("buildGoStructs", () => {
  it("emits a plain struct with default bare json+db tags", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "c2", name: "email", type: "varchar(255)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
      ],
    });
    const { code, warnings } = buildGoStructs([table], []);
    expect(warnings).toEqual([]);
    expect(code).toContain("package models");
    expect(code).toContain("type User struct {");
    expect(code).toContain('Id string `json:"id" db:"id"`');
    expect(code).toContain('Email string `json:"email" db:"email"`');
  });

  it("uses the tablePrefixed tagValueNaming preset", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
      ],
    });
    const { code } = buildGoStructs([table], [], { tagValueNaming: "tablePrefixed" });
    expect(code).toContain('Id string `json:"users_id" db:"users_id"`');
  });

  it("accepts a custom tagValueNaming function", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
      ],
    });
    const { code } = buildGoStructs([table], [], {
      tagValueNaming: (t, c) => `custom_${t}_${c}`,
    });
    expect(code).toContain('Id string `json:"custom_users_id" db:"custom_users_id"`');
  });

  it("wraps nullable non-PK columns in a pointer by default", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "c2", name: "age", type: "integer", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const { code } = buildGoStructs([table], []);
    expect(code).toContain("Id string");
    expect(code).toContain("Age *int32");
  });

  it("does not pointer-wrap nullable columns when pointerForNullable is false", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "age", type: "integer", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const { code } = buildGoStructs([table], [], { pointerForNullable: false });
    expect(code).toContain("Age int32");
    expect(code).not.toContain("*int32");
  });

  it("respects tags.json=false / tags.db=false toggles independently", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
      ],
    });
    const jsonOnly = buildGoStructs([table], [], { tags: { json: true, db: false } });
    expect(jsonOnly.code).toContain('`json:"id"`');
    expect(jsonOnly.code).not.toContain("db:");

    const dbOnly = buildGoStructs([table], [], { tags: { json: false, db: true } });
    expect(dbOnly.code).toContain('`db:"id"`');
    expect(dbOnly.code).not.toContain("json:");

    const neither = buildGoStructs([table], [], { tags: { json: false, db: false } });
    expect(neither.code).not.toContain("`");
  });

  it("only emits the time import when a timestamp/date column is present", () => {
    const withoutTime = mkTable({ columns: [{ id: "c1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }] });
    expect(buildGoStructs([withoutTime], []).code).not.toContain('"time"');

    const withTime = mkTable({ columns: [{ id: "c1", name: "created_at", type: "timestamptz", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null }] });
    const { code } = buildGoStructs([withTime], []);
    expect(code).toContain('import "time"');
  });

  it("only emits the encoding/json import when a json/jsonb column is present", () => {
    const table = mkTable({ columns: [{ id: "c1", name: "meta", type: "jsonb", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null }] });
    const { code } = buildGoStructs([table], []);
    expect(code).toContain('import "encoding/json"');
  });

  it("emits a grouped import block when multiple imports are needed", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "created_at", type: "timestamptz", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
        { id: "c2", name: "meta", type: "jsonb", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const { code } = buildGoStructs([table], []);
    expect(code).toContain("import (");
    expect(code).toContain('"encoding/json"');
    expect(code).toContain('"time"');
  });

  it("warns on unsupported types and falls back to interface{}", () => {
    const table = mkTable({ columns: [{ id: "c1", name: "vec", type: "tsvector", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null }] });
    const { code, warnings } = buildGoStructs([table], []);
    expect(code).toContain("interface{}");
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("tsvector");
  });

  it("does not synthesize relation fields from foreign keys", () => {
    const users = mkTable({ id: "u", name: "users", columns: [{ id: "uc", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }] });
    const posts = mkTable({
      id: "p",
      name: "posts",
      columns: [
        { id: "pc1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "pc2", name: "author_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
    });
    const fk: ForeignKey = { id: "f1", sourceTableId: "p", sourceColumnId: "pc2", targetTableId: "u", targetColumnId: "uc", onDelete: "CASCADE", onUpdate: "CASCADE" };
    const { code } = buildGoStructs([users, posts], [fk]);
    expect(code).toContain("type Post struct {");
    expect(code).toContain("AuthorId string");
    expect(code).not.toContain("*User");
    expect(code).not.toContain("[]Post");
  });

  it("respects a custom packageName option", () => {
    const table = mkTable();
    const { code } = buildGoStructs([table], [], { packageName: "entities" });
    expect(code).toContain("package entities");
  });
});
