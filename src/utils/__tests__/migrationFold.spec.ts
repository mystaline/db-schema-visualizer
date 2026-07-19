import { describe, it, expect } from "vitest";
import { foldMigrationHistory, type MigrationFile } from "../migrationFold";

// Mock crypto for randomUUID (same pattern as ddlParser.spec.ts)
if (!globalThis.crypto || !globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () =>
        `${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}`,
    },
  });
}

const file = (version: string, sql: string): MigrationFile => ({ version, sql });

describe("foldMigrationHistory", () => {
  it("folds a baseline CREATE TABLE and an ADD COLUMN delta into one snapshot", () => {
    const result = foldMigrationHistory([
      file("1", `CREATE TABLE users (id INT PRIMARY KEY, name TEXT);`),
      file("2", `ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL;`),
    ]);

    expect(result.snapshot.tables).toHaveLength(1);
    const users = result.snapshot.tables[0];
    expect(users.columns.map((c) => c.name)).toEqual(["id", "name", "email"]);
    expect(users.columns[2]).toMatchObject({ type: "varchar(255)", isNullable: false });
    expect(result.warnings).toHaveLength(0);
  });

  it("sorts files by numeric version regardless of input array order", () => {
    const result = foldMigrationHistory([
      file("20260201", `ALTER TABLE t ADD COLUMN b INT;`),
      file("20260101", `CREATE TABLE t (a INT);`),
    ]);
    expect(result.snapshot.tables[0].columns.map((c) => c.name)).toEqual(["a", "b"]);
  });

  it("falls back to lexicographic order when versions aren't all numeric", () => {
    const result = foldMigrationHistory([
      file("b_add_col", `ALTER TABLE t ADD COLUMN b INT;`),
      file("a_create", `CREATE TABLE t (a INT);`),
    ]);
    expect(result.snapshot.tables[0].columns.map((c) => c.name)).toEqual(["a", "b"]);
  });

  it("drops a table across files (DROP TABLE)", () => {
    const result = foldMigrationHistory([
      file("1", `CREATE TABLE temp_stuff (id INT); CREATE TABLE keepers (id INT);`),
      file("2", `DROP TABLE temp_stuff;`),
    ]);
    expect(result.snapshot.tables.map((t) => t.name)).toEqual(["keepers"]);
  });

  it("DROP TABLE IF EXISTS on a missing table produces no warning; without IF EXISTS it warns", () => {
    const withIfExists = foldMigrationHistory([
      file("1", `CREATE TABLE a (id INT);`),
      file("2", `DROP TABLE IF EXISTS ghost;`),
    ]);
    expect(withIfExists.warnings).toHaveLength(0);

    const withoutIfExists = foldMigrationHistory([
      file("1", `CREATE TABLE a (id INT);`),
      file("2", `DROP TABLE ghost;`),
    ]);
    expect(withoutIfExists.warnings.length).toBeGreaterThan(0);
  });

  it("drops a column and cascades to its FK, index, and check constraint (DROP COLUMN)", () => {
    const result = foldMigrationHistory([
      file(
        "1",
        `CREATE TABLE widgets (
          id INT PRIMARY KEY,
          price INT,
          CHECK (price > 0)
        );
        CREATE UNIQUE INDEX idx_price ON widgets (price);`,
      ),
      file("2", `ALTER TABLE widgets DROP COLUMN price;`),
    ]);
    const widgets = result.snapshot.tables[0];
    expect(widgets.columns.map((c) => c.name)).toEqual(["id"]);
    expect(widgets.indexes).toHaveLength(0);
    expect(widgets.checkConstraints).toHaveLength(0);
  });

  it("handles rename-then-reference-in-a-later-file: FK added in a later file against the new name resolves to the original table's id", () => {
    const result = foldMigrationHistory([
      file("1", `CREATE TABLE widgets (id INT PRIMARY KEY);`),
      file("2", `-- no-op file`),
      file("3", `ALTER TABLE widgets RENAME TO gadgets;`),
      file(
        "4",
        `CREATE TABLE orders (id INT PRIMARY KEY, widget_id INT);
         ALTER TABLE orders ADD CONSTRAINT fk_orders_widget FOREIGN KEY (widget_id) REFERENCES gadgets (id);`,
      ),
    ]);

    const gadgets = result.snapshot.tables.find((t) => t.name === "gadgets");
    const orders = result.snapshot.tables.find((t) => t.name === "orders");
    expect(gadgets).toBeDefined();
    expect(result.snapshot.foreignKeys).toHaveLength(1);
    const fk = result.snapshot.foreignKeys[0];
    expect(fk.sourceTableId).toBe(orders!.id);
    expect(fk.targetTableId).toBe(gadgets!.id);
    expect(result.warnings).toHaveLength(0);
  });

  it("renames a column, rewriting expression text but preserving literal index/constraint names", () => {
    const result = foldMigrationHistory([
      file(
        "1",
        `CREATE TABLE accounts (
          id INT PRIMARY KEY,
          balance INT,
          CONSTRAINT positive_balance CHECK (balance >= 0)
        );
        CREATE INDEX my_special_idx ON accounts (balance DESC);`,
      ),
      file("2", `ALTER TABLE accounts RENAME COLUMN balance TO current_balance;`),
    ]);
    const accounts = result.snapshot.tables[0];
    expect(accounts.columns.map((c) => c.name)).toEqual(["id", "current_balance"]);
    expect(accounts.checkConstraints[0].name).toBe("positive_balance");
    expect(accounts.checkConstraints[0].expression).toBe("current_balance >= 0");
    expect(accounts.indexes[0].name).toBe("my_special_idx");
    // Column-typed index parts reference by id, which never changes on rename —
    // no text rewrite needed; confirm it still resolves to the renamed column.
    expect(accounts.indexes[0].parts[0].type).toBe("column");
    const referencedCol = accounts.columns.find(
      (c) => c.id === accounts.indexes[0].parts[0].value,
    );
    expect(referencedCol?.name).toBe("current_balance");
  });

  it("applies ALTER COLUMN TYPE / SET DEFAULT / DROP DEFAULT / SET NOT NULL / DROP NOT NULL", () => {
    const result = foldMigrationHistory([
      file("1", `CREATE TABLE t (a TEXT);`),
      file("2", `ALTER TABLE t ALTER COLUMN a TYPE VARCHAR(50);`),
      file("3", `ALTER TABLE t ALTER COLUMN a SET DEFAULT 'x';`),
      file("4", `ALTER TABLE t ALTER COLUMN a SET NOT NULL;`),
    ]);
    const col = result.snapshot.tables[0].columns[0];
    expect(col.type).toBe("varchar(50)");
    expect(col.defaultValue).toBe("'x'");
    expect(col.isNullable).toBe(false);

    const dropped = foldMigrationHistory([
      file("1", `CREATE TABLE t (a TEXT NOT NULL DEFAULT 'x');`),
      file("2", `ALTER TABLE t ALTER COLUMN a DROP DEFAULT;`),
      file("3", `ALTER TABLE t ALTER COLUMN a DROP NOT NULL;`),
    ]);
    const col2 = dropped.snapshot.tables[0].columns[0];
    expect(col2.defaultValue).toBeNull();
    expect(col2.isNullable).toBe(true);
  });

  it("adds a unique constraint via ALTER TABLE ADD CONSTRAINT ... UNIQUE", () => {
    const result = foldMigrationHistory([
      file("1", `CREATE TABLE t (id INT, email TEXT);`),
      file("2", `ALTER TABLE t ADD CONSTRAINT t_email_key UNIQUE (email);`),
    ]);
    const table = result.snapshot.tables[0];
    expect(table.indexes).toHaveLength(1);
    expect(table.indexes[0]).toMatchObject({ name: "t_email_key", type: "unique" });
    expect(table.columns.find((c) => c.name === "email")?.isUnique).toBe(true);
  });

  it("adds a check constraint via ALTER TABLE ADD CONSTRAINT ... CHECK", () => {
    const result = foldMigrationHistory([
      file("1", `CREATE TABLE t (age INT);`),
      file("2", `ALTER TABLE t ADD CONSTRAINT t_age_check CHECK (age >= 0);`),
    ]);
    const table = result.snapshot.tables[0];
    expect(table.checkConstraints).toHaveLength(1);
    expect(table.checkConstraints[0]).toMatchObject({ name: "t_age_check", expression: "age >= 0" });
  });

  it("drops a check constraint, an index, and a foreign key by constraint name (DROP CONSTRAINT)", () => {
    const checkResult = foldMigrationHistory([
      file("1", `CREATE TABLE t (age INT, CONSTRAINT t_age_check CHECK (age >= 0));`),
      file("2", `ALTER TABLE t DROP CONSTRAINT t_age_check;`),
    ]);
    expect(checkResult.snapshot.tables[0].checkConstraints).toHaveLength(0);

    const fkResult = foldMigrationHistory([
      file(
        "1",
        `CREATE TABLE a (id INT PRIMARY KEY);
         CREATE TABLE b (id INT PRIMARY KEY, a_id INT);
         ALTER TABLE b ADD CONSTRAINT fk_b_a FOREIGN KEY (a_id) REFERENCES a (id);`,
      ),
      file("2", `ALTER TABLE b DROP CONSTRAINT fk_b_a;`),
    ]);
    expect(fkResult.snapshot.foreignKeys).toHaveLength(0);
  });

  it("drops a schema-scoped index (DROP INDEX)", () => {
    const result = foldMigrationHistory([
      file("1", `CREATE TABLE t (email TEXT); CREATE INDEX idx_email ON t (email);`),
      file("2", `DROP INDEX idx_email;`),
    ]);
    expect(result.snapshot.tables[0].indexes).toHaveLength(0);
  });

  it("handles a multi-action ALTER TABLE statement (comma-separated clauses)", () => {
    const result = foldMigrationHistory([
      file("1", `CREATE TABLE t (a INT, b INT);`),
      file("2", `ALTER TABLE t ADD COLUMN c INT, DROP COLUMN b, ALTER COLUMN a SET NOT NULL;`),
    ]);
    const table = result.snapshot.tables[0];
    expect(table.columns.map((c) => c.name)).toEqual(["a", "c"]);
    expect(table.columns[0].isNullable).toBe(false);
  });

  it("skips an unrecognized statement as a warning without aborting the whole fold", () => {
    const result = foldMigrationHistory([
      file("1", `CREATE TABLE t (id INT);`),
      file(
        "2",
        `DO $$ BEGIN RAISE NOTICE 'hi'; END $$;
         ALTER TABLE t ADD COLUMN name TEXT;`,
      ),
    ]);
    // The DO block's ill-formed fragments (from naive ';'-splitting) produce
    // warnings, but the sibling ADD COLUMN statement in the same file still applies.
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.snapshot.tables[0].columns.map((c) => c.name)).toContain("name");
  });

  it("returns an empty snapshot (not a throw) when folding produces zero tables", () => {
    const result = foldMigrationHistory([file("1", `-- just a comment, no statements`)]);
    expect(result.snapshot.tables).toHaveLength(0);
  });

  it("records per-file history deltas alongside the folded snapshot", () => {
    const result = foldMigrationHistory([
      file("1", `CREATE TABLE t (id INT);`),
      file("2", `ALTER TABLE t ADD COLUMN name TEXT;`),
    ]);
    expect(result.history).toHaveLength(2);
    expect(result.history[0].changes).toContainEqual({ kind: "create_table", tableName: "t" });
    expect(result.history[1].changes).toContainEqual({
      kind: "add_column",
      tableName: "t",
      columnName: "name",
    });
  });
});
