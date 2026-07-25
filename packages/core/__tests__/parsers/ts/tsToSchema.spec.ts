import { describe, it, expect } from "vitest";
import { parseTsInterfaces } from "../../../src/parsers/ts/tsToSchema";

describe("parseTsInterfaces", () => {
  it("parses a basic interface into a table with columns", () => {
    const src = `
export interface User {
  id: string;
  email: string;
}
`;
    const { tables, foreignKeys, warnings } = parseTsInterfaces(src);
    expect(warnings).toEqual([]);
    expect(foreignKeys).toEqual([]);
    expect(tables).toHaveLength(1);
    const table = tables[0];
    expect(table.name).toBe("users");
    expect(table.columns).toHaveLength(2);
    expect(table.columns[0]).toMatchObject({ name: "id", type: "text", isPrimaryKey: true, isNullable: false });
    expect(table.columns[1]).toMatchObject({ name: "email", type: "text", isPrimaryKey: false });
  });

  it("maps number/boolean keyword types", () => {
    const src = `
interface Widget {
  id: string;
  weight: number;
  active: boolean;
}
`;
    const { tables } = parseTsInterfaces(src);
    const cols = tables[0].columns;
    expect(cols.find((c) => c.name === "weight")!.type).toBe("numeric");
    expect(cols.find((c) => c.name === "active")!.type).toBe("boolean");
  });

  it("treats `T | null` unions as nullable", () => {
    const src = `
interface User {
  id: string;
  age: number | null;
}
`;
    const { tables } = parseTsInterfaces(src);
    expect(tables[0].columns.find((c) => c.name === "age")!.isNullable).toBe(true);
  });

  it("treats optional (?) fields as nullable", () => {
    const src = `
interface User {
  id: string;
  nickname?: string;
}
`;
    const { tables } = parseTsInterfaces(src);
    expect(tables[0].columns.find((c) => c.name === "nickname")!.isNullable).toBe(true);
  });

  it("maps Date to timestamp", () => {
    const src = `
interface Event {
  id: string;
  startsAt: Date;
}
`;
    const { tables, warnings } = parseTsInterfaces(src);
    expect(tables[0].columns.find((c) => c.name === "starts_at")!.type).toBe("timestamp");
    expect(warnings).toEqual([]);
  });

  it("snake_cases camelCase field names into column names", () => {
    const src = `
interface User {
  id: string;
  firstName: string;
}
`;
    const { tables } = parseTsInterfaces(src);
    expect(tables[0].columns.map((c) => c.name)).toContain("first_name");
  });

  it("warns and drops members when heritage clauses (extends) are present", () => {
    const src = `
interface Base {
  id: string;
}
interface User extends Base {
  email: string;
}
`;
    const { tables, warnings } = parseTsInterfaces(src);
    const user = tables.find((t) => t.name === "users")!;
    expect(user.columns.map((c) => c.name)).toEqual(["email"]);
    expect(warnings.some((w) => w.includes("extends/heritage"))).toBe(true);
  });

  it("warns and skips method signatures", () => {
    const src = `
interface User {
  id: string;
  greet(): string;
}
`;
    const { tables, warnings } = parseTsInterfaces(src);
    expect(tables[0].columns).toHaveLength(1);
    expect(warnings.some((w) => w.includes("method/call signatures"))).toBe(true);
  });

  it("warns and skips index signatures", () => {
    const src = `
interface Bag {
  id: string;
  [key: string]: unknown;
}
`;
    const { tables, warnings } = parseTsInterfaces(src);
    expect(tables[0].columns).toHaveLength(1);
    expect(warnings.some((w) => w.includes("index signatures"))).toBe(true);
  });

  it("warns and falls back to text for nested object type literals", () => {
    const src = `
interface User {
  id: string;
  address: { street: string };
}
`;
    const { tables, warnings } = parseTsInterfaces(src);
    const address = tables[0].columns.find((c) => c.name === "address")!;
    expect(address.type).toBe("text");
    expect(warnings.some((w) => w.includes("nested object type literals"))).toBe(true);
  });

  it("warns and falls back to text for array types", () => {
    const src = `
interface User {
  id: string;
  tags: string[];
}
`;
    const { tables, warnings } = parseTsInterfaces(src);
    expect(tables[0].columns.find((c) => c.name === "tags")!.type).toBe("text");
    expect(warnings.some((w) => w.includes("array types"))).toBe(true);
  });

  it("warns and falls back to text for enum-like string literal unions", () => {
    const src = `
interface User {
  id: string;
  role: "admin" | "member";
}
`;
    const { tables, warnings } = parseTsInterfaces(src);
    expect(tables[0].columns.find((c) => c.name === "role")!.type).toBe("text");
    expect(warnings.some((w) => w.includes("multi-member/enum-like union"))).toBe(true);
  });

  it("warns and falls back to text for generic/referenced types", () => {
    const src = `
interface User {
  id: string;
  meta: Record<string, unknown>;
}
`;
    const { tables, warnings } = parseTsInterfaces(src);
    expect(tables[0].columns.find((c) => c.name === "meta")!.type).toBe("text");
    expect(warnings.some((w) => w.includes("Record"))).toBe(true);
  });

  it("parses multiple interfaces into multiple tables", () => {
    const src = `
interface User { id: string; }
interface Post { id: string; }
`;
    const { tables } = parseTsInterfaces(src);
    expect(tables.map((t) => t.name).sort()).toEqual(["posts", "users"]);
  });
});
