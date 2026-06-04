import { describe, it, expect } from "vitest";
import { buildMermaidEr } from "../mermaid";
import type { Table, ForeignKey } from "../../../stores/schemaStore";

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

const mkFk = (overrides: Partial<ForeignKey> = {}): ForeignKey => ({
  id: "fk1",
  sourceTableId: "t2",
  sourceColumnId: "c_fk",
  targetTableId: "t1",
  targetColumnId: "c_id",
  onDelete: "NO ACTION",
  onUpdate: "NO ACTION",
  ...overrides,
});

describe("buildMermaidEr", () => {
  it("returns minimal erDiagram header for empty schema", () => {
    const { diagram } = buildMermaidEr([], []);
    expect(diagram.trim()).toBe("erDiagram");
  });

  it("emits table block with typed columns", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "c2", name: "email", type: "varchar(255)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
        { id: "c3", name: "bio", type: "text", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const { diagram } = buildMermaidEr([table], []);
    expect(diagram).toContain("users {");
    expect(diagram).toContain("int id PK");
    expect(diagram).toContain("varchar email");
    expect(diagram).toContain("varchar bio");
    expect(diagram).not.toContain("PK\n  varchar email");
  });

  it("marks unique non-PK columns with UK", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "c2", name: "slug", type: "text", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
      ],
    });
    const { diagram } = buildMermaidEr([table], []);
    expect(diagram).toContain("varchar slug UK");
  });

  it("emits FK relationship with correct cardinality: nullable source, unique target", () => {
    const users = mkTable({
      id: "t1",
      name: "users",
      columns: [{ id: "c_id", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({
      id: "t2",
      name: "posts",
      columns: [
        { id: "c1", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "c_fk", name: "user_id", type: "integer", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { diagram } = buildMermaidEr([users, posts], [fk]);
    // users (target, unique) ||--o{ posts (source, nullable)
    expect(diagram).toContain("users ||--o{ posts");
  });

  it("emits FK relationship with |{ when source is not nullable", () => {
    const users = mkTable({
      id: "t1",
      name: "users",
      columns: [{ id: "c_id", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({
      id: "t2",
      name: "posts",
      columns: [
        { id: "c_fk", name: "user_id", type: "integer", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
    });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { diagram } = buildMermaidEr([users, posts], [fk]);
    expect(diagram).toContain("users ||--|{ posts");
  });

  it("emits FK with |{ on target side when target col is not unique", () => {
    const users = mkTable({
      id: "t1",
      name: "users",
      columns: [{ id: "c_id", name: "id", type: "integer", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null }],
    });
    const posts = mkTable({
      id: "t2",
      name: "posts",
      columns: [
        { id: "c_fk", name: "user_id", type: "integer", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { diagram } = buildMermaidEr([users, posts], [fk]);
    expect(diagram).toContain("users |{--o{ posts");
  });

  it("uses source column name as FK label", () => {
    const users = mkTable({
      id: "t1",
      name: "users",
      columns: [{ id: "c_id", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({
      id: "t2",
      name: "posts",
      columns: [
        { id: "c_fk", name: "user_id", type: "integer", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { diagram } = buildMermaidEr([users, posts], [fk]);
    expect(diagram).toContain(': "user_id"');
  });

  it("skips FK with broken column reference and emits a warning", () => {
    const users = mkTable({
      id: "t1",
      name: "users",
      columns: [{ id: "c_id", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({
      id: "t2",
      name: "posts",
      columns: [],
    });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_missing", targetTableId: "t1", targetColumnId: "c_id" });
    const { diagram, warnings } = buildMermaidEr([users, posts], [fk]);
    expect(diagram).not.toContain("--");
    expect(warnings.some((w) => w.toLowerCase().includes("column"))).toBe(true);
  });

  it("emits a warning when a FK references a table not in the schema", () => {
    const users = mkTable({
      id: "t1",
      name: "users",
      columns: [{ id: "c_id", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const fk = mkFk({ sourceTableId: "t_ghost", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { diagram, warnings } = buildMermaidEr([users], [fk]);
    expect(diagram).not.toContain("--");
    expect(warnings.some((w) => w.toLowerCase().includes("table"))).toBe(true);
  });

  it("detects expression indexes via legacy expressions[] field", () => {
    const table = mkTable({
      columns: [{ id: "c1", name: "email", type: "text", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null }],
      indexes: [
        {
          id: "idx1",
          name: "idx_legacy_expr",
          type: "normal",
          parts: [],
          expressions: ["lower(email)"],
        } as any,
      ],
    });
    const { warnings } = buildMermaidEr([table], []);
    expect(warnings.some((w) => w.includes("idx_legacy_expr"))).toBe(true);
  });

  it("emits %% comment and warning for CHECK constraints", () => {
    const table = mkTable({
      checkConstraints: [{ id: "ck1", name: "positive_amount", expression: "amount > 0" }],
      columns: [{ id: "c1", name: "amount", type: "integer", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null }],
    });
    const { diagram, warnings } = buildMermaidEr([table], []);
    expect(diagram).toContain("%% CHECK positive_amount");
    expect(warnings.some((w) => w.includes("CHECK"))).toBe(true);
  });

  it("emits %% comment and warning for expression indexes", () => {
    const table = mkTable({
      columns: [{ id: "c1", name: "email", type: "text", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null }],
      indexes: [
        {
          id: "idx1",
          name: "idx_lower_email",
          type: "normal",
          parts: [{ type: "expression", value: "lower(email)" }],
        },
      ],
    });
    const { diagram, warnings } = buildMermaidEr([table], []);
    expect(diagram).toContain("%% INDEX idx_lower_email");
    expect(warnings.some((w) => w.includes("idx_lower_email"))).toBe(true);
  });

  it("returns no warnings for a clean schema", () => {
    const table = mkTable({
      columns: [{ id: "c1", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const { warnings } = buildMermaidEr([table], []);
    expect(warnings).toHaveLength(0);
  });

  it("annotates FK source columns with FK marker", () => {
    const users = mkTable({
      id: "t1",
      name: "users",
      columns: [{ id: "c_id", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({
      id: "t2",
      name: "posts",
      columns: [
        { id: "c1", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "c_fk", name: "user_id", type: "integer", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
    });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { diagram } = buildMermaidEr([users, posts], [fk]);
    expect(diagram).toContain("int user_id FK");
  });

  it("annotates a column that is both PK and FK with PK, FK", () => {
    const users = mkTable({
      id: "t1",
      name: "users",
      columns: [{ id: "c_id", name: "id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({
      id: "t2",
      name: "posts",
      columns: [
        { id: "c_fk", name: "user_id", type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
      ],
    });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { diagram } = buildMermaidEr([users, posts], [fk]);
    expect(diagram).toContain("int user_id PK, FK");
  });

  it("replaces spaces in table names with underscores", () => {
    const table = mkTable({ name: "my table", columns: [] });
    const { diagram } = buildMermaidEr([table], []);
    expect(diagram).toContain("my_table {");
    expect(diagram).not.toContain("my table");
  });

  it("replaces spaces in column names with underscores", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "first name", type: "text", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const { diagram } = buildMermaidEr([table], []);
    expect(diagram).toContain("varchar first_name");
    expect(diagram).not.toContain("first name");
  });

  it("escapes double-quotes in FK label", () => {
    const users = mkTable({
      id: "t1",
      name: "users",
      columns: [{ id: "c_id", name: 'id"x', type: "integer", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({
      id: "t2",
      name: "posts",
      columns: [
        { id: 'c_fk', name: 'user"id', type: "integer", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id" });
    const { diagram } = buildMermaidEr([users, posts], [fk]);
    expect(diagram).not.toMatch(/: ".*".*"/);
    expect(diagram).toContain(": \"user'id\"");
  });
});
