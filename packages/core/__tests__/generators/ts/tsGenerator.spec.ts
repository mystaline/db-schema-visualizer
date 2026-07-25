import { describe, it, expect } from "vitest";
import { buildTsInterfaces } from "../../../src/generators/ts/tsGenerator";
import type { SchemaTable, ForeignKey } from "../../../src/types";

const mkTable = (overrides: Partial<SchemaTable> = {}): SchemaTable => ({
  id: "t1",
  name: "users",
  columns: [],
  indexes: [],
  checkConstraints: [],
  ...overrides,
});

describe("buildTsInterfaces", () => {
  it("emits an exported interface with camelCase field names", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "c2", name: "first_name", type: "text", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
    });
    const { code, warnings } = buildTsInterfaces([table], []);
    expect(warnings).toEqual([]);
    expect(code).toContain("export interface User {");
    expect(code).toContain("id: string;");
    expect(code).toContain("firstName: string;");
  });

  it("marks nullable non-PK columns optional and unions with null by default", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "age", type: "integer", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const { code } = buildTsInterfaces([table], []);
    expect(code).toContain("age?: number | null;");
  });

  it("keeps nullable fields required (no ?) when optionalForNullable is false", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "age", type: "integer", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const { code } = buildTsInterfaces([table], [], { optionalForNullable: false });
    expect(code).toContain("age: number | null;");
    expect(code).not.toContain("age?:");
  });

  it("does not mark non-nullable columns optional or nullable", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "email", type: "text", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
      ],
    });
    const { code } = buildTsInterfaces([table], []);
    expect(code).toContain("email: string;");
    expect(code).not.toContain("email?:");
    expect(code).not.toContain("| null");
  });

  it("omits the export keyword when exportKeyword is false", () => {
    const table = mkTable();
    const { code } = buildTsInterfaces([table], [], { exportKeyword: false });
    expect(code).toContain("interface User {");
    expect(code).not.toContain("export interface");
  });

  it("warns on unsupported types and falls back to unknown", () => {
    const table = mkTable({ columns: [{ id: "c1", name: "vec", type: "tsvector", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null }] });
    const { code, warnings } = buildTsInterfaces([table], []);
    expect(code).toContain("unknown");
    expect(warnings.length).toBe(1);
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
    const { code } = buildTsInterfaces([users, posts], [fk]);
    expect(code).toContain("export interface Post {");
    expect(code).toContain("authorId: string;");
    expect(code).not.toContain("User;");
    expect(code).not.toContain("User[]");
  });
});
