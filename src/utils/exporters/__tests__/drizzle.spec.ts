import { describe, it, expect } from "vitest";
import { pgTypeToDrizzle, buildDrizzleSchema } from "../drizzle";
import type { Table, ForeignKey } from "../../../stores/schemaStore";

// ---- helpers ----

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

const col = (
  id: string,
  name: string,
  type: string,
  opts: Partial<{ isPrimaryKey: boolean; isNullable: boolean; isUnique: boolean; defaultValue: string | null }> = {},
) => ({
  id,
  name,
  type,
  isPrimaryKey: false,
  isNullable: true,
  isUnique: false,
  defaultValue: null,
  ...opts,
});

// ---- pgTypeToDrizzle ----

describe("pgTypeToDrizzle", () => {
  it("maps integer variants", () => {
    expect(pgTypeToDrizzle("integer").helper).toBe("integer");
    expect(pgTypeToDrizzle("int").helper).toBe("integer");
    expect(pgTypeToDrizzle("int4").helper).toBe("integer");
  });

  it("maps bigint with mode option", () => {
    const r = pgTypeToDrizzle("bigint");
    expect(r.helper).toBe("bigint");
    expect(r.options).toContain("number");
  });

  it("maps smallint", () => {
    expect(pgTypeToDrizzle("smallint").helper).toBe("smallint");
    expect(pgTypeToDrizzle("int2").helper).toBe("smallint");
  });

  it("maps text", () => {
    expect(pgTypeToDrizzle("text").helper).toBe("text");
  });

  it("maps varchar with length", () => {
    const r = pgTypeToDrizzle("varchar(255)");
    expect(r.helper).toBe("varchar");
    expect(r.options).toBe("{ length: 255 }");
  });

  it("maps character varying with length", () => {
    const r = pgTypeToDrizzle("character varying(100)");
    expect(r.helper).toBe("varchar");
    expect(r.options).toBe("{ length: 100 }");
  });

  it("maps varchar without length", () => {
    const r = pgTypeToDrizzle("varchar");
    expect(r.helper).toBe("varchar");
    expect(r.options).toBeUndefined();
  });

  it("maps numeric with precision and scale", () => {
    const r = pgTypeToDrizzle("numeric(10, 2)");
    expect(r.helper).toBe("numeric");
    expect(r.options).toBe("{ precision: 10, scale: 2 }");
  });

  it("maps numeric with precision only", () => {
    const r = pgTypeToDrizzle("numeric(10)");
    expect(r.helper).toBe("numeric");
    expect(r.options).toBe("{ precision: 10 }");
  });

  it("maps numeric without params", () => {
    expect(pgTypeToDrizzle("numeric").helper).toBe("numeric");
    expect(pgTypeToDrizzle("numeric").options).toBeUndefined();
  });

  it("maps boolean", () => {
    expect(pgTypeToDrizzle("boolean").helper).toBe("boolean");
    expect(pgTypeToDrizzle("bool").helper).toBe("boolean");
  });

  it("maps uuid", () => {
    expect(pgTypeToDrizzle("uuid").helper).toBe("uuid");
  });

  it("maps timestamp without tz", () => {
    const r = pgTypeToDrizzle("timestamp");
    expect(r.helper).toBe("timestamp");
    expect(r.options).toBeUndefined();
  });

  it("maps timestamptz with withTimezone option", () => {
    const r = pgTypeToDrizzle("timestamptz");
    expect(r.helper).toBe("timestamp");
    expect(r.options).toContain("withTimezone");
  });

  it("maps timestamp with time zone", () => {
    const r = pgTypeToDrizzle("timestamp with time zone");
    expect(r.helper).toBe("timestamp");
    expect(r.options).toContain("withTimezone");
  });

  it("maps date, time, timetz", () => {
    expect(pgTypeToDrizzle("date").helper).toBe("date");
    expect(pgTypeToDrizzle("time").helper).toBe("time");
    const r = pgTypeToDrizzle("timetz");
    expect(r.helper).toBe("time");
    expect(r.options).toContain("withTimezone");
  });

  it("maps json and jsonb", () => {
    expect(pgTypeToDrizzle("json").helper).toBe("json");
    expect(pgTypeToDrizzle("jsonb").helper).toBe("jsonb");
  });

  it("maps float variants", () => {
    expect(pgTypeToDrizzle("real").helper).toBe("real");
    expect(pgTypeToDrizzle("float4").helper).toBe("real");
    expect(pgTypeToDrizzle("double precision").helper).toBe("doublePrecision");
    expect(pgTypeToDrizzle("float8").helper).toBe("doublePrecision");
  });

  it("maps serial and bigserial", () => {
    expect(pgTypeToDrizzle("serial").helper).toBe("serial");
    expect(pgTypeToDrizzle("bigserial").helper).toBe("bigserial");
  });

  it("falls back to text for unknown types", () => {
    expect(pgTypeToDrizzle("cidr").helper).toBe("text");
    expect(pgTypeToDrizzle("").helper).toBe("text");
  });

  it("marks unknown types as isUnsupported", () => {
    expect(pgTypeToDrizzle("cidr").isUnsupported).toBe(true);
    expect(pgTypeToDrizzle("macaddr").isUnsupported).toBe(true);
    expect(pgTypeToDrizzle("").isUnsupported).toBe(true);
  });

  it("does not mark known types as isUnsupported", () => {
    expect(pgTypeToDrizzle("integer").isUnsupported).toBeUndefined();
    expect(pgTypeToDrizzle("text").isUnsupported).toBeUndefined();
    expect(pgTypeToDrizzle("uuid").isUnsupported).toBeUndefined();
  });
});

// ---- buildDrizzleSchema ----

describe("buildDrizzleSchema", () => {
  it("returns a schema string and warnings array", () => {
    const { schema, warnings } = buildDrizzleSchema([], []);
    expect(typeof schema).toBe("string");
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("includes a header comment with SchemaViz attribution", () => {
    const { schema } = buildDrizzleSchema([], []);
    expect(schema).toContain("SchemaViz");
  });

  it("emits pgTable call with correct table name", () => {
    const t = mkTable({ name: "users", columns: [col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('pgTable("users"');
  });

  it("converts snake_case table name to camelCase variable", () => {
    const t = mkTable({ name: "user_accounts", columns: [col("c1", "id", "integer")] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain("export const userAccounts =");
    expect(schema).toContain('pgTable("user_accounts"');
  });

  it("converts snake_case column name to camelCase property", () => {
    const t = mkTable({ columns: [col("c1", "created_at", "timestamp")] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain("createdAt:");
    expect(schema).toContain('timestamp("created_at")');
  });

  it("emits .notNull() for non-nullable columns", () => {
    const t = mkTable({ columns: [col("c1", "email", "text", { isNullable: false })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('.notNull()');
  });

  it("does not emit .notNull() for nullable columns", () => {
    const t = mkTable({ columns: [col("c1", "bio", "text", { isNullable: true })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).not.toContain('.notNull()');
  });

  it("emits .unique() for unique non-PK columns", () => {
    const t = mkTable({ columns: [col("c1", "slug", "text", { isUnique: true, isNullable: false })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('.unique()');
  });

  it("emits .primaryKey() for single-column PK", () => {
    const t = mkTable({ columns: [col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('.primaryKey()');
  });

  it("emits primaryKey({ columns }) in table callback for composite PK", () => {
    const t = mkTable({
      columns: [
        col("c1", "project_id", "integer", { isPrimaryKey: true, isNullable: false }),
        col("c2", "user_id", "integer", { isPrimaryKey: true, isNullable: false }),
      ],
    });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain("primaryKey(");
    expect(schema).toContain("table.projectId");
    expect(schema).toContain("table.userId");
    expect(schema).not.toMatch(/\.primaryKey\(\)\s*,/); // no inline .primaryKey()
  });

  it("emits varchar with { length } option", () => {
    const t = mkTable({ columns: [col("c1", "name", "varchar(255)")] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('varchar("name", { length: 255 })');
  });

  it("emits numeric with precision and scale", () => {
    const t = mkTable({ columns: [col("c1", "price", "numeric(10, 2)")] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('numeric("price", { precision: 10, scale: 2 })');
  });

  it("emits .default() with literal number", () => {
    const t = mkTable({ columns: [col("c1", "count", "integer", { defaultValue: "0" })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('.default(0)');
  });

  it("emits .default() with string literal (single-quoted)", () => {
    const t = mkTable({ columns: [col("c1", "status", "text", { defaultValue: "'active'" })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('.default("active")');
  });

  it("emits .default(sql`...`) for SQL expressions", () => {
    const t = mkTable({ columns: [col("c1", "id", "uuid", { defaultValue: "gen_random_uuid()" })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain(".default(sql`gen_random_uuid()`)");
  });

  it("emits .references() for FK columns with cascade", () => {
    const users = mkTable({ id: "t1", name: "users", columns: [col("c_id", "id", "integer", { isPrimaryKey: true, isNullable: false })] });
    const posts = mkTable({
      id: "t2", name: "posts",
      columns: [
        col("c1", "id", "integer", { isPrimaryKey: true, isNullable: false }),
        col("c_fk", "user_id", "integer", { isNullable: false }),
      ],
    });
    const fk = mkFk({ sourceTableId: "t2", sourceColumnId: "c_fk", targetTableId: "t1", targetColumnId: "c_id", onDelete: "CASCADE" });
    const { schema } = buildDrizzleSchema([users, posts], [fk]);
    expect(schema).toContain('.references(() => users.id');
    expect(schema).toContain('"cascade"');
  });

  it("omits onDelete/onUpdate from references() when both are NO ACTION", () => {
    const users = mkTable({ id: "t1", name: "users", columns: [col("c_id", "id", "integer")] });
    const posts = mkTable({ id: "t2", name: "posts", columns: [col("c_fk", "user_id", "integer")] });
    const fk = mkFk({ onDelete: "NO ACTION", onUpdate: "NO ACTION" });
    const { schema } = buildDrizzleSchema([users, posts], [fk]);
    expect(schema).toContain('.references(() => users.id)');
    expect(schema).not.toContain('onDelete');
  });

  it("places referenced table before referencing table", () => {
    const users = mkTable({ id: "t1", name: "users", columns: [col("c_id", "id", "integer")] });
    const posts = mkTable({ id: "t2", name: "posts", columns: [col("c_fk", "user_id", "integer")] });
    const fk = mkFk({ sourceTableId: "t2", targetTableId: "t1" });
    const { schema } = buildDrizzleSchema([posts, users], [fk]); // posts first, but users should end up first
    const usersPos = schema.indexOf("export const users");
    const postsPos = schema.indexOf("export const posts");
    expect(usersPos).toBeLessThan(postsPos);
  });

  it("emits index() in table callback for regular index", () => {
    const t = mkTable({
      columns: [col("c1", "email", "text")],
      indexes: [{ id: "i1", name: "idx_users_email", type: "normal", parts: [{ type: "column", value: "c1" }] }],
    });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('index("idx_users_email").on(table.email)');
  });

  it("emits uniqueIndex() for unique indexes", () => {
    const t = mkTable({
      columns: [col("c1", "slug", "text")],
      indexes: [{ id: "i1", name: "idx_slug", type: "unique", parts: [{ type: "column", value: "c1" }] }],
    });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('uniqueIndex("idx_slug").on(table.slug)');
  });

  it("emits .where(sql`...`) for partial indexes", () => {
    const t = mkTable({
      columns: [col("c1", "status", "text")],
      indexes: [{ id: "i1", name: "idx_active", type: "normal", parts: [{ type: "column", value: "c1" }], filter: "status = 'active'" }],
    });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain(".where(sql`status = 'active'`)");
  });

  it("skips expression indexes and returns a warning", () => {
    const t = mkTable({
      columns: [col("c1", "email", "text")],
      indexes: [{ id: "i1", name: "idx_lower_email", type: "normal", parts: [{ type: "expression", value: "lower(email)" }] }],
    });
    const { schema, warnings } = buildDrizzleSchema([t], []);
    expect(schema).not.toContain('index("idx_lower_email")');
    expect(warnings.some((w) => w.includes("idx_lower_email"))).toBe(true);
  });

  it("emits check() constraint in table callback", () => {
    const t = mkTable({
      columns: [col("c1", "amount", "integer")],
      checkConstraints: [{ id: "ck1", name: "positive_amount", expression: "amount > 0" }],
    });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('check("positive_amount", sql`amount > 0`)');
  });

  it("includes all column helpers in pg-core import", () => {
    const t = mkTable({
      columns: [
        col("c1", "id", "uuid", { isPrimaryKey: true, isNullable: false }),
        col("c2", "name", "varchar(100)", { isNullable: false }),
        col("c3", "score", "integer"),
      ],
    });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('from "drizzle-orm/pg-core"');
    expect(schema).toMatch(/import \{[^}]*uuid[^}]*\}/);
    expect(schema).toMatch(/import \{[^}]*varchar[^}]*\}/);
    expect(schema).toMatch(/import \{[^}]*integer[^}]*\}/);
  });

  it("imports sql from drizzle-orm when SQL expressions are used", () => {
    const t = mkTable({
      columns: [col("c1", "id", "uuid", { defaultValue: "gen_random_uuid()" })],
    });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain('from "drizzle-orm"');
  });

  it("does not import sql from drizzle-orm when no SQL expressions are used", () => {
    const t = mkTable({ columns: [col("c1", "id", "integer", { isPrimaryKey: true })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).not.toContain('from "drizzle-orm"');
  });

  it("adds requires drizzle-orm >= 0.31.0 comment when check constraints are present", () => {
    const t = mkTable({
      columns: [col("c1", "amount", "integer")],
      checkConstraints: [{ id: "ck1", name: "pos", expression: "amount > 0" }],
    });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain("0.31.0");
  });

  it("adds requires drizzle-orm >= 0.31.0 comment when indexes use array callback", () => {
    const t = mkTable({
      columns: [col("c1", "email", "text")],
      indexes: [{ id: "i1", name: "idx_email", type: "normal", parts: [{ type: "column", value: "c1" }] }],
    });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain("0.31.0");
  });

  it("adds requires drizzle-orm >= 0.31.0 comment when composite PK uses array callback", () => {
    const t = mkTable({
      columns: [
        col("c1", "a", "integer", { isPrimaryKey: true }),
        col("c2", "b", "integer", { isPrimaryKey: true }),
      ],
    });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain("0.31.0");
  });

  it("omits version comment when no array callback is used", () => {
    const t = mkTable({ columns: [col("c1", "id", "integer", { isPrimaryKey: true })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).not.toContain("0.31.0");
  });

  it("omits table callback third argument when no extras exist", () => {
    const t = mkTable({ columns: [col("c1", "id", "integer", { isPrimaryKey: true })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).not.toContain("(table) =>");
  });

  // Issue 1: unsupported type warning
  it("emits a warning for each column using an unsupported PostgreSQL type", () => {
    const t = mkTable({
      name: "things",
      columns: [
        col("c1", "id", "integer"),
        col("c2", "addr", "cidr"),
        col("c3", "mac", "macaddr"),
      ],
    });
    const { warnings } = buildDrizzleSchema([t], []);
    expect(warnings.some((w) => w.includes("cidr") && w.includes("things"))).toBe(true);
    expect(warnings.some((w) => w.includes("macaddr") && w.includes("things"))).toBe(true);
  });

  // Issue 2: empty column-ref index warning
  it("emits a warning when index has no resolvable column references", () => {
    const t = mkTable({
      columns: [col("c1", "email", "text")],
      indexes: [{
        id: "i1",
        name: "idx_orphan",
        type: "normal",
        parts: [{ type: "column", value: "nonexistent_col_id" }],
      }],
    });
    const { warnings } = buildDrizzleSchema([t], []);
    expect(warnings.some((w) => w.includes("idx_orphan"))).toBe(true);
  });

  // Issue 3: duplicate variable name warning
  it("emits a warning when two tables produce the same variable name", () => {
    const a = mkTable({ id: "t1", name: "user_info", columns: [col("c1", "id", "integer")] });
    const b = mkTable({ id: "t2", name: "user-info", columns: [col("c2", "id", "integer")] });
    const { warnings } = buildDrizzleSchema([a, b], []);
    expect(warnings.some((w) => w.toLowerCase().includes("conflict") || w.toLowerCase().includes("duplicate"))).toBe(true);
  });

  // Issue 4: FK action validation
  it("emits a warning and skips unknown FK action values", () => {
    const users = mkTable({ id: "t1", name: "users", columns: [col("c_id", "id", "integer")] });
    const posts = mkTable({ id: "t2", name: "posts", columns: [col("c_fk", "user_id", "integer")] });
    const fk = mkFk({ onDelete: "SOME_INVALID_ACTION" as any, onUpdate: "NO ACTION" });
    const { schema, warnings } = buildDrizzleSchema([users, posts], [fk]);
    expect(schema).not.toContain("some_invalid_action");
    expect(warnings.some((w) => w.toLowerCase().includes("ondelete") || w.toLowerCase().includes("action"))).toBe(true);
  });

  it("correctly maps SET NULL and RESTRICT FK actions", () => {
    const users = mkTable({ id: "t1", name: "users", columns: [col("c_id", "id", "integer")] });
    const posts = mkTable({ id: "t2", name: "posts", columns: [col("c_fk", "user_id", "integer")] });
    const fk = mkFk({ onDelete: "SET NULL", onUpdate: "RESTRICT" });
    const { schema } = buildDrizzleSchema([users, posts], [fk]);
    expect(schema).toContain('"set null"');
    expect(schema).toContain('"restrict"');
  });

  // Issue 6: backticks in default values
  it("escapes backticks inside SQL expression defaults", () => {
    const t = mkTable({ columns: [col("c1", "val", "text", { defaultValue: "some`thing`here" })] });
    const { schema } = buildDrizzleSchema([t], []);
    expect(schema).toContain("sql`some\\`thing\\`here`");
  });

  // Issue 7: cycle warning names tables
  it("cycle warning includes the names of tables involved", () => {
    const a = mkTable({ id: "t1", name: "alpha", columns: [col("c1", "id", "integer"), col("c2", "beta_id", "integer")] });
    const b = mkTable({ id: "t2", name: "beta", columns: [col("c3", "id", "integer"), col("c4", "alpha_id", "integer")] });
    const fk1 = mkFk({ id: "fk1", sourceTableId: "t1", sourceColumnId: "c2", targetTableId: "t2", targetColumnId: "c3" });
    const fk2 = mkFk({ id: "fk2", sourceTableId: "t2", sourceColumnId: "c4", targetTableId: "t1", targetColumnId: "c1" });
    const { warnings } = buildDrizzleSchema([a, b], [fk1, fk2]);
    const cycleWarn = warnings.find((w) => w.toLowerCase().includes("circular"));
    expect(cycleWarn).toBeTruthy();
    expect(cycleWarn).toMatch(/alpha|beta/i);
  });
});
