import { describe, it, expect } from "vitest";
import { parseDDL } from "../ddlParser";

// Mock crypto for randomUUID
if (!globalThis.crypto || !globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => `${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}`
    }
  });
}

describe("ddlParser (Enhanced Robustness)", () => {
  it("parses a basic CREATE TABLE statement", () => {
    const sql = `CREATE TABLE users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      age INT DEFAULT 18
    );`;

    const result = parseDDL(sql);
    expect(result.tables).toHaveLength(1);
    const table = result.tables[0];
    expect(table.name).toBe("users");
    expect(table.columns).toHaveLength(3);
    
    expect(table.columns[0]).toMatchObject({ name: "id", type: "uuid", isPrimaryKey: true });
    expect(table.columns[1]).toMatchObject({ name: "email", type: "varchar(255)", isUnique: true, isNullable: false });
    expect(table.columns[2]).toMatchObject({ name: "age", type: "int", defaultValue: "18" });
  });

  it("handles multi-word types like TIMESTAMP WITH TIME ZONE", () => {
    const sql = `CREATE TABLE logs (
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      data JSONB NOT NULL
    );`;
    const result = parseDDL(sql);
    expect(result.tables[0].columns[0].type).toBe("timestamp with time zone");
    expect(result.tables[0].columns[0].defaultValue).toBe("NOW()");
  });

  it("handles quoted identifiers with spaces and special characters", () => {
    const sql = `CREATE TABLE "User Profile" (
      "First Name" TEXT,
      "@handle" VARCHAR(50)
    );`;
    const result = parseDDL(sql);
    const table = result.tables[0];
    expect(table.name).toBe("User Profile");
    expect(table.columns[0].name).toBe("First Name");
    expect(table.columns[1].name).toBe("@handle");
  });

  it("is case-insensitive for SQL keywords", () => {
    const sql = `create table items (
      id serial primary key,
      name text unique
    );`;
    const result = parseDDL(sql);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe("items");
    expect(result.tables[0].columns[1].isUnique).toBe(true);
  });

  it("handles multi-column primary keys correctly", () => {
    const sql = `CREATE TABLE link_table (
      a_id INT,
      b_id INT,
      PRIMARY KEY (a_id, b_id)
    );`;
    const result = parseDDL(sql);
    const table = result.tables[0];
    const colA = table.columns.filter(c => c.name === "a_id")[0];
    const colB = table.columns.filter(c => c.name === "b_id")[0];
    expect(colA.isPrimaryKey).toBe(true);
    expect(colB.isPrimaryKey).toBe(true);
  });

  it("handles table-level constraints and expressions", () => {
    const sql = `CREATE TABLE orders (
      id INT PRIMARY KEY,
      amount NUMERIC(10,2),
      CONSTRAINT chk_amount CHECK (amount > 0)
    );`;

    const result = parseDDL(sql);
    const table = result.tables[0];
    expect(table.checkConstraints).toHaveLength(1);
    expect(table.checkConstraints[0].name).toBe("chk_amount");
    expect(table.checkConstraints[0].expression).toBe("amount > 0");
  });

  it("parses foreign keys from ALTER TABLE", () => {
    const sql = `
      CREATE TABLE posts (id INT PRIMARY KEY);
      CREATE TABLE comments (id INT PRIMARY KEY, post_id INT);
      ALTER TABLE comments ADD CONSTRAINT fk_posts FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE;
    `;

    const result = parseDDL(sql);
    expect(result.tables).toHaveLength(2);
    expect(result.foreignKeys).toHaveLength(1);
    
    const posts = result.tables.filter(t => t.name === "posts")[0];
    const comments = result.tables.filter(t => t.name === "comments")[0];
    const fk = result.foreignKeys[0];
    
    expect(fk.sourceTableId).toBe(comments.id);
    expect(fk.targetTableId).toBe(posts.id);
    expect(fk.onDelete).toBe("CASCADE");
  });

  it("parses indexes with expressions and order", () => {
    const sql = `
      CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR);
      CREATE UNIQUE INDEX idx_email_lower ON users (lower(email) DESC);
    `;

    const result = parseDDL(sql);
    const table = result.tables[0];
    expect(table.indexes).toHaveLength(1);
    const idx = table.indexes[0];
    expect(idx.name).toBe("idx_email_lower");
    expect(idx.type).toBe("unique");
    expect(idx.parts[0]).toMatchObject({ type: "expression", value: "lower(email)", order: "DESC" });
  });
});
