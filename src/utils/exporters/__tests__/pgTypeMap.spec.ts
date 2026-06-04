import { describe, it, expect } from "vitest";
import { pgTypeToMermaid } from "../pgTypeMap";

describe("pgTypeToMermaid", () => {
  it("maps integer variants to int", () => {
    expect(pgTypeToMermaid("integer")).toBe("int");
    expect(pgTypeToMermaid("int")).toBe("int");
    expect(pgTypeToMermaid("int4")).toBe("int");
    expect(pgTypeToMermaid("bigint")).toBe("bigint");
    expect(pgTypeToMermaid("int8")).toBe("bigint");
    expect(pgTypeToMermaid("smallint")).toBe("smallint");
    expect(pgTypeToMermaid("int2")).toBe("smallint");
  });

  it("maps text/varchar variants, stripping length", () => {
    expect(pgTypeToMermaid("text")).toBe("varchar");
    expect(pgTypeToMermaid("varchar(255)")).toBe("varchar");
    expect(pgTypeToMermaid("character varying(100)")).toBe("varchar");
    expect(pgTypeToMermaid("char(10)")).toBe("char");
    expect(pgTypeToMermaid("character(10)")).toBe("char");
  });

  it("maps boolean variants", () => {
    expect(pgTypeToMermaid("boolean")).toBe("boolean");
    expect(pgTypeToMermaid("bool")).toBe("boolean");
  });

  it("maps timestamp variants", () => {
    expect(pgTypeToMermaid("timestamp")).toBe("timestamp");
    expect(pgTypeToMermaid("timestamp without time zone")).toBe("timestamp");
    expect(pgTypeToMermaid("timestamptz")).toBe("timestamp");
    expect(pgTypeToMermaid("timestamp with time zone")).toBe("timestamp");
  });

  it("maps date and time", () => {
    expect(pgTypeToMermaid("date")).toBe("date");
    expect(pgTypeToMermaid("time")).toBe("time");
    expect(pgTypeToMermaid("timetz")).toBe("time");
    expect(pgTypeToMermaid("time with time zone")).toBe("time");
  });

  it("maps uuid", () => {
    expect(pgTypeToMermaid("uuid")).toBe("uuid");
  });

  it("maps json variants", () => {
    expect(pgTypeToMermaid("json")).toBe("json");
    expect(pgTypeToMermaid("jsonb")).toBe("json");
  });

  it("maps numeric/decimal variants, stripping precision", () => {
    expect(pgTypeToMermaid("numeric")).toBe("decimal");
    expect(pgTypeToMermaid("numeric(10,2)")).toBe("decimal");
    expect(pgTypeToMermaid("decimal")).toBe("decimal");
    expect(pgTypeToMermaid("decimal(5,2)")).toBe("decimal");
  });

  it("maps float variants", () => {
    expect(pgTypeToMermaid("float")).toBe("float");
    expect(pgTypeToMermaid("float4")).toBe("float");
    expect(pgTypeToMermaid("float8")).toBe("float");
    expect(pgTypeToMermaid("real")).toBe("float");
    expect(pgTypeToMermaid("double precision")).toBe("float");
  });

  it("maps bytea", () => {
    expect(pgTypeToMermaid("bytea")).toBe("bytes");
  });

  it("passes through unknown types lowercased with spaces removed", () => {
    expect(pgTypeToMermaid("CIDR")).toBe("cidr");
    expect(pgTypeToMermaid("inet")).toBe("inet");
    expect(pgTypeToMermaid("Some Custom Type")).toBe("some_custom_type");
  });

  it("strips parenthesised size from unknown types in fallback path", () => {
    expect(pgTypeToMermaid("My Custom Type(10)")).toBe("my_custom_type");
    expect(pgTypeToMermaid("citext(255)")).toBe("citext");
  });

  it("returns 'unknown' for empty string input", () => {
    expect(pgTypeToMermaid("")).toBe("unknown");
    expect(pgTypeToMermaid("   ")).toBe("unknown");
  });
});
