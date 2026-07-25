import { describe, it, expect } from "vitest";
import { parseGoStructs } from "../../../src/parsers/go/goToSchema";

describe("parseGoStructs", () => {
  it("parses a basic struct into a table with columns", () => {
    const src = `
package models

type User struct {
	Id    string \`json:"id" db:"id"\`
	Email string \`json:"email" db:"email"\`
}
`;
    const { tables, foreignKeys, warnings } = parseGoStructs(src);
    expect(warnings).toEqual([]);
    expect(foreignKeys).toEqual([]);
    expect(tables).toHaveLength(1);
    const table = tables[0];
    expect(table.name).toBe("users");
    expect(table.columns).toHaveLength(2);
    expect(table.columns[0]).toMatchObject({ name: "id", type: "text", isPrimaryKey: true, isNullable: false });
    expect(table.columns[1]).toMatchObject({ name: "email", type: "text", isPrimaryKey: false });
  });

  it("marks pointer fields as nullable", () => {
    const src = `
type User struct {
	Id  string \`db:"id"\`
	Age *int32  \`db:"age"\`
}
`;
    const { tables } = parseGoStructs(src);
    const age = tables[0].columns.find((c) => c.name === "age")!;
    expect(age.isNullable).toBe(true);
    expect(age.type).toBe("integer");
  });

  it("uses the db tag value as the column name when present, else snake_case of the field name", () => {
    const src = `
type User struct {
	Id        string \`db:"id"\`
	FirstName string
}
`;
    const { tables } = parseGoStructs(src);
    const names = tables[0].columns.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("first_name");
  });

  it("falls back to the json tag value when there is no db tag", () => {
    const src = `
type User struct {
	Id string \`json:"id,omitempty"\`
}
`;
    const { tables } = parseGoStructs(src);
    expect(tables[0].columns[0].name).toBe("id");
  });

  it("parses multiple structs into multiple tables", () => {
    const src = `
type User struct {
	Id string \`db:"id"\`
}

type Post struct {
	Id string \`db:"id"\`
}
`;
    const { tables } = parseGoStructs(src);
    expect(tables.map((t) => t.name).sort()).toEqual(["posts", "users"]);
  });

  it("skips embedded/anonymous fields with a warning", () => {
    const src = `
type User struct {
	Base
	Id string \`db:"id"\`
}
`;
    const { tables, warnings } = parseGoStructs(src);
    expect(tables[0].columns).toHaveLength(1);
    expect(warnings.some((w) => w.includes("embedded"))).toBe(true);
  });

  it("skips slice-of-struct fields with a warning (no nested table extraction)", () => {
    const src = `
type User struct {
	Id    string \`db:"id"\`
	Posts []Post
}
`;
    const { tables, warnings } = parseGoStructs(src);
    expect(tables[0].columns).toHaveLength(1);
    expect(warnings.some((w) => w.includes("slice-of-struct"))).toBe(true);
  });

  it("skips pointer-to-struct fields with a warning (no FK inference)", () => {
    const src = `
type Post struct {
	Id     string \`db:"id"\`
	Author *User
}
`;
    const { tables, warnings, foreignKeys } = parseGoStructs(src);
    expect(tables[0].columns).toHaveLength(1);
    expect(foreignKeys).toEqual([]);
    expect(warnings.some((w) => w.includes("relation"))).toBe(true);
  });

  it("allows []byte as a scalar field, not a slice-of-struct", () => {
    const src = `
type File struct {
	Id   string \`db:"id"\`
	Data []byte \`db:"data"\`
}
`;
    const { tables, warnings } = parseGoStructs(src);
    expect(tables[0].columns).toHaveLength(2);
    expect(tables[0].columns[1]).toMatchObject({ name: "data", type: "bytea" });
    expect(warnings).toEqual([]);
  });

  it("warns and falls back to text for an unrecognized scalar type", () => {
    const src = `
type Widget struct {
	Id     string  \`db:"id"\`
	Weight complex128 \`db:"weight"\`
}
`;
    const { tables, warnings } = parseGoStructs(src);
    const weight = tables[0].columns.find((c) => c.name === "weight")!;
    expect(weight.type).toBe("text");
    expect(warnings.some((w) => w.includes("complex128"))).toBe(true);
  });

  it("ignores methods on the type (only type X struct {} blocks are scanned)", () => {
    const src = `
type User struct {
	Id string \`db:"id"\`
}

func (u *User) String() string {
	return u.Id
}
`;
    const { tables } = parseGoStructs(src);
    expect(tables).toHaveLength(1);
    expect(tables[0].columns).toHaveLength(1);
  });
});
