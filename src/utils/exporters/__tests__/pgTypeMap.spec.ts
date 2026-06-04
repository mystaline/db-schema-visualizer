import { describe, it, expect } from "vitest";
import { pgTypeToMermaid, pgTypeToPrisma } from "../pgTypeMap";

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

describe("pgTypeToPrisma", () => {
  it("maps integer variants to Int", () => {
    expect(pgTypeToPrisma("integer").scalar).toBe("Int");
    expect(pgTypeToPrisma("int").scalar).toBe("Int");
    expect(pgTypeToPrisma("int4").scalar).toBe("Int");
  });

  it("maps smallint to Int with @db.SmallInt", () => {
    const r = pgTypeToPrisma("smallint");
    expect(r.scalar).toBe("Int");
    expect(r.nativeType).toBe("@db.SmallInt");
  });

  it("maps bigint to BigInt", () => {
    expect(pgTypeToPrisma("bigint").scalar).toBe("BigInt");
    expect(pgTypeToPrisma("int8").scalar).toBe("BigInt");
  });

  it("maps serial to Int with isSerial flag", () => {
    const r = pgTypeToPrisma("serial");
    expect(r.scalar).toBe("Int");
    expect(r.isSerial).toBe(true);
  });

  it("maps bigserial to BigInt with isSerial flag", () => {
    const r = pgTypeToPrisma("bigserial");
    expect(r.scalar).toBe("BigInt");
    expect(r.isSerial).toBe(true);
  });

  it("maps text to String", () => {
    expect(pgTypeToPrisma("text").scalar).toBe("String");
    expect(pgTypeToPrisma("text").nativeType).toBeUndefined();
  });

  it("maps varchar(n) to String with @db.VarChar(n)", () => {
    const r = pgTypeToPrisma("varchar(255)");
    expect(r.scalar).toBe("String");
    expect(r.nativeType).toBe("@db.VarChar(255)");
  });

  it("maps varchar without length to String", () => {
    const r = pgTypeToPrisma("varchar");
    expect(r.scalar).toBe("String");
    expect(r.nativeType).toBeUndefined();
  });

  it("maps char(n) to String with @db.Char(n)", () => {
    const r = pgTypeToPrisma("char(10)");
    expect(r.scalar).toBe("String");
    expect(r.nativeType).toBe("@db.Char(10)");
  });

  it("maps boolean to Boolean", () => {
    expect(pgTypeToPrisma("boolean").scalar).toBe("Boolean");
    expect(pgTypeToPrisma("bool").scalar).toBe("Boolean");
  });

  it("maps uuid to String with @db.Uuid", () => {
    const r = pgTypeToPrisma("uuid");
    expect(r.scalar).toBe("String");
    expect(r.nativeType).toBe("@db.Uuid");
  });

  it("maps timestamp to DateTime with @db.Timestamp(6)", () => {
    const r = pgTypeToPrisma("timestamp");
    expect(r.scalar).toBe("DateTime");
    expect(r.nativeType).toBe("@db.Timestamp(6)");
  });

  it("maps timestamptz to DateTime with @db.Timestamptz(6)", () => {
    const r = pgTypeToPrisma("timestamptz");
    expect(r.scalar).toBe("DateTime");
    expect(r.nativeType).toBe("@db.Timestamptz(6)");
  });

  it("maps date to DateTime with @db.Date", () => {
    const r = pgTypeToPrisma("date");
    expect(r.scalar).toBe("DateTime");
    expect(r.nativeType).toBe("@db.Date");
  });

  it("maps time to DateTime with @db.Time(6)", () => {
    const r = pgTypeToPrisma("time");
    expect(r.scalar).toBe("DateTime");
    expect(r.nativeType).toBe("@db.Time(6)");
  });

  it("maps json and jsonb to Json", () => {
    expect(pgTypeToPrisma("json").scalar).toBe("Json");
    expect(pgTypeToPrisma("jsonb").scalar).toBe("Json");
  });

  it("maps numeric(p,s) to Decimal with @db.Decimal(p, s)", () => {
    const r = pgTypeToPrisma("numeric(10, 2)");
    expect(r.scalar).toBe("Decimal");
    expect(r.nativeType).toBe("@db.Decimal(10, 2)");
  });

  it("maps numeric without params to Decimal", () => {
    expect(pgTypeToPrisma("numeric").scalar).toBe("Decimal");
    expect(pgTypeToPrisma("numeric").nativeType).toBeUndefined();
  });

  it("maps real to Float with @db.Real", () => {
    const r = pgTypeToPrisma("real");
    expect(r.scalar).toBe("Float");
    expect(r.nativeType).toBe("@db.Real");
  });

  it("maps double precision to Float", () => {
    expect(pgTypeToPrisma("double precision").scalar).toBe("Float");
    expect(pgTypeToPrisma("double precision").nativeType).toBeUndefined();
  });

  it("maps bytea to Bytes", () => {
    expect(pgTypeToPrisma("bytea").scalar).toBe("Bytes");
  });

  it("maps unknown types to Unsupported with isUnsupported flag", () => {
    const r = pgTypeToPrisma("cidr");
    expect(r.scalar).toBe('Unsupported("cidr")');
    expect(r.isUnsupported).toBe(true);
  });

  it("maps empty string to Unsupported with isUnsupported flag", () => {
    const r = pgTypeToPrisma("");
    expect(r.isUnsupported).toBe(true);
  });

  it("known types do not set isUnsupported", () => {
    expect(pgTypeToPrisma("integer").isUnsupported).toBeUndefined();
    expect(pgTypeToPrisma("text").isUnsupported).toBeUndefined();
  });
});
