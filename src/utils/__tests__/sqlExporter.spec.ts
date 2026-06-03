import { describe, it, expect } from "vitest";
import {
  buildTableSql,
  buildSchemaSql,
  countCrossBoundaryFks,
  hasBrokenRefs,
} from "../sqlExporter";
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

describe("buildTableSql", () => {
  it("emits CREATE TABLE with columns, NOT NULL, UNIQUE, DEFAULT", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: "gen_random_uuid()" },
        { id: "c2", name: "email", type: "varchar(255)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
        { id: "c3", name: "bio", type: "text", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
      ],
    });
    const sql = buildTableSql(table, [table], [], {
      exportSet: new Set(["t1"]),
      markCrossBoundary: false,
    });
    expect(sql).toContain("CREATE TABLE users (");
    expect(sql).toContain("id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()");
    expect(sql).toContain("email varchar(255) NOT NULL UNIQUE");
    expect(sql).toContain("bio text");
    expect(sql).toContain("PRIMARY KEY (id)");
  });

  it("emits table notes as -- comments above CREATE TABLE", () => {
    const table = mkTable({
      notes: "First line\nSecond line",
      columns: [
        { id: "c1", name: "id", type: "int", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
      ],
    });
    const sql = buildTableSql(table, [table], [], {
      exportSet: new Set(["t1"]),
      markCrossBoundary: false,
    });
    expect(sql).toContain("-- First line");
    expect(sql).toContain("-- Second line");
    expect(sql.indexOf("-- First line")).toBeLessThan(sql.indexOf("CREATE TABLE"));
  });

  it("emits named CHECK constraints", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "qty", type: "int", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
      checkConstraints: [{ id: "k1", name: "chk_qty_pos", expression: "qty > 0" }],
    });
    const sql = buildTableSql(table, [table], [], {
      exportSet: new Set(["t1"]),
      markCrossBoundary: false,
    });
    expect(sql).toContain("CONSTRAINT chk_qty_pos CHECK (qty > 0)");
  });

  it("emits ALTER TABLE ADD CONSTRAINT for outgoing FKs to in-set targets", () => {
    const users = mkTable({ id: "u", name: "users",
      columns: [{ id: "uc", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({ id: "p", name: "posts",
      columns: [
        { id: "pc1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "pc2", name: "author_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
    });
    const fk: ForeignKey = {
      id: "f1", sourceTableId: "p", sourceColumnId: "pc2",
      targetTableId: "u", targetColumnId: "uc",
      onDelete: "CASCADE", onUpdate: "CASCADE",
    };
    const sql = buildTableSql(posts, [users, posts], [fk], {
      exportSet: new Set(["u", "p"]),
      markCrossBoundary: true,
    });
    expect(sql).toContain("ALTER TABLE posts");
    expect(sql).toContain("ADD CONSTRAINT fk_posts_author_id");
    expect(sql).toContain("FOREIGN KEY (author_id) REFERENCES users (id)");
    expect(sql).toContain("ON DELETE CASCADE ON UPDATE CASCADE");
    expect(sql).not.toContain("-- WARNING: cross-boundary");
  });

  it("prefixes outgoing FK with -- WARNING comment when target outside exportSet and markCrossBoundary=true", () => {
    const users = mkTable({ id: "u", name: "users",
      columns: [{ id: "uc", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({ id: "p", name: "posts",
      columns: [
        { id: "pc1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "pc2", name: "author_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
    });
    const fk: ForeignKey = {
      id: "f1", sourceTableId: "p", sourceColumnId: "pc2",
      targetTableId: "u", targetColumnId: "uc",
      onDelete: "CASCADE", onUpdate: "CASCADE",
    };
    const sql = buildTableSql(posts, [users, posts], [fk], {
      exportSet: new Set(["p"]), // users excluded
      markCrossBoundary: true,
    });
    expect(sql).toContain("-- WARNING: cross-boundary foreign key — references users not in this selection");
    expect(sql).toContain("ALTER TABLE posts"); // still emitted
  });

  it("does NOT add cross-boundary warning when markCrossBoundary=false", () => {
    const users = mkTable({ id: "u", name: "users",
      columns: [{ id: "uc", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({ id: "p", name: "posts",
      columns: [
        { id: "pc1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        { id: "pc2", name: "author_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
    });
    const fk: ForeignKey = {
      id: "f1", sourceTableId: "p", sourceColumnId: "pc2",
      targetTableId: "u", targetColumnId: "uc",
      onDelete: "CASCADE", onUpdate: "CASCADE",
    };
    const sql = buildTableSql(posts, [users, posts], [fk], {
      exportSet: new Set(["p"]),
      markCrossBoundary: false,
    });
    expect(sql).not.toContain("-- WARNING: cross-boundary");
  });

  it("emits broken-column WARNING when FK references a deleted column", () => {
    const users = mkTable({ id: "u", name: "users",
      columns: [{ id: "uc", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const posts = mkTable({ id: "p", name: "posts",
      columns: [
        { id: "pc1", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
        // pc2 deleted — but FK still references it
      ],
    });
    const fk: ForeignKey = {
      id: "f1", sourceTableId: "p", sourceColumnId: "pc2",
      targetTableId: "u", targetColumnId: "uc",
      onDelete: "CASCADE", onUpdate: "CASCADE",
    };
    const sql = buildTableSql(posts, [users, posts], [fk], {
      exportSet: new Set(["u", "p"]),
      markCrossBoundary: false,
    });
    expect(sql).toContain("-- WARNING: foreign key between posts and users was skipped (column reference is broken)");
    expect(sql).not.toContain("ALTER TABLE posts");
  });

  it("emits CREATE INDEX for column and expression parts with order", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "email", type: "varchar(255)", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
      indexes: [{
        id: "i1", name: "idx_users_lower_email",
        type: "unique",
        parts: [
          { type: "column", value: "c1", order: "ASC" },
          { type: "expression", value: "lower(email)", order: "ASC" },
        ],
        filter: "deleted_at IS NULL",
      }],
    });
    const sql = buildTableSql(table, [table], [], {
      exportSet: new Set(["t1"]), markCrossBoundary: false,
    });
    expect(sql).toContain("CREATE UNIQUE INDEX idx_users_lower_email ON users (email, lower(email)) WHERE deleted_at IS NULL");
  });

  it("emits DESC suffix on column index part", () => {
    const table = mkTable({
      columns: [
        { id: "c1", name: "created_at", type: "timestamptz", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
      ],
      indexes: [{
        id: "i1", name: "idx_users_created_desc",
        type: "normal",
        parts: [{ type: "column", value: "c1", order: "DESC" }],
        filter: "",
      }],
    });
    const sql = buildTableSql(table, [table], [], {
      exportSet: new Set(["t1"]), markCrossBoundary: false,
    });
    expect(sql).toContain("CREATE INDEX idx_users_created_desc ON users (created_at DESC)");
  });

  it("emits broken-index WARNING when all parts reference deleted columns", () => {
    const table = mkTable({
      columns: [],
      indexes: [{
        id: "i1", name: "idx_dead",
        type: "normal",
        parts: [{ type: "column", value: "ghost-col-id", order: "ASC" }],
        filter: "",
      }],
    });
    const sql = buildTableSql(table, [table], [], {
      exportSet: new Set(["t1"]), markCrossBoundary: false,
    });
    expect(sql).toContain("-- WARNING: index idx_dead on users was skipped (all column/expression references are broken: column:ghost-col-id)");
  });
});

describe("buildSchemaSql", () => {
  it("includes header comment with generation timestamp", () => {
    const t = mkTable();
    const sql = buildSchemaSql([t], [], {
      exportSet: new Set(["t1"]), markCrossBoundary: false,
    });
    expect(sql).toMatch(/^-- Database Schema SQL Export/);
    expect(sql).toContain("-- Generated on");
  });

  it("omits tables not in exportSet (subset export)", () => {
    const a = mkTable({ id: "a", name: "alpha",
      columns: [{ id: "ac", name: "id", type: "int", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const b = mkTable({ id: "b", name: "beta",
      columns: [{ id: "bc", name: "id", type: "int", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const sql = buildSchemaSql([a, b], [], {
      exportSet: new Set(["a"]), markCrossBoundary: true,
    });
    expect(sql).toContain("CREATE TABLE alpha");
    expect(sql).not.toContain("CREATE TABLE beta");
  });

  it("joins multiple tables with a blank line between them", () => {
    const a = mkTable({ id: "a", name: "alpha",
      columns: [{ id: "ac", name: "id", type: "int", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const b = mkTable({ id: "b", name: "beta",
      columns: [{ id: "bc", name: "id", type: "int", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }],
    });
    const sql = buildSchemaSql([a, b], [], {
      exportSet: new Set(["a", "b"]), markCrossBoundary: false,
    });
    expect(sql.indexOf("CREATE TABLE alpha")).toBeLessThan(sql.indexOf("CREATE TABLE beta"));
  });
});

describe("countCrossBoundaryFks", () => {
  it("counts FKs whose source is in set but target is not", () => {
    const fks: ForeignKey[] = [
      { id: "1", sourceTableId: "a", sourceColumnId: "x", targetTableId: "b", targetColumnId: "y", onDelete: "CASCADE", onUpdate: "CASCADE" },
      { id: "2", sourceTableId: "a", sourceColumnId: "x", targetTableId: "c", targetColumnId: "y", onDelete: "CASCADE", onUpdate: "CASCADE" },
      { id: "3", sourceTableId: "z", sourceColumnId: "x", targetTableId: "a", targetColumnId: "y", onDelete: "CASCADE", onUpdate: "CASCADE" }, // source not in set — ignored
    ];
    const tables = [
      mkTable({ id: "a", name: "alpha", columns: [{ id: "x", name: "x", type: "int", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null }] }),
      mkTable({ id: "b", name: "beta", columns: [] }),
      mkTable({ id: "c", name: "gamma", columns: [] }),
    ];
    expect(countCrossBoundaryFks(new Set(["a"]), fks, tables)).toBe(2);
    expect(countCrossBoundaryFks(new Set(["a", "b", "c"]), fks, tables)).toBe(0);
  });
});

describe("hasBrokenRefs", () => {
  it("returns true when FK references a missing table", () => {
    const t = mkTable({ id: "a", name: "alpha",
      columns: [{ id: "ac", name: "x", type: "int", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null }],
    });
    const fk: ForeignKey = { id: "f", sourceTableId: "a", sourceColumnId: "ac", targetTableId: "ghost", targetColumnId: "g", onDelete: "CASCADE", onUpdate: "CASCADE" };
    expect(hasBrokenRefs([t], [fk])).toBe(true);
  });

  it("returns true when an index references a deleted column", () => {
    const t = mkTable({ id: "a", name: "alpha", columns: [],
      indexes: [{ id: "i", name: "idx", type: "normal", parts: [{ type: "column", value: "ghost", order: "ASC" }], filter: "" }],
    });
    expect(hasBrokenRefs([t], [])).toBe(true);
  });

  it("returns false for a clean schema", () => {
    const t = mkTable({ columns: [{ id: "c1", name: "id", type: "int", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null }] });
    expect(hasBrokenRefs([t], [])).toBe(false);
  });
});
