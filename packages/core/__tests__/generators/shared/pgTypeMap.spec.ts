import { describe, it, expect } from "vitest";
import {
  pgTypeToMermaid,
  pgTypeToPrisma,
  pgTypeToGo,
  goTypeToPg,
  pgTypeToTs,
  tsTypeToPg,
} from "../../../src/generators/shared/pgTypeMap";

describe("pgTypeToTs", () => {
  it("maps integer/numeric/float family to number", () => {
    for (const t of ["integer", "bigint", "smallint", "numeric(10,2)", "decimal", "real", "double precision", "float8"]) {
      expect(pgTypeToTs(t).tsType).toBe("number");
    }
  });

  it("maps text/varchar/char/uuid to string", () => {
    for (const t of ["text", "varchar(255)", "char(10)", "uuid"]) {
      expect(pgTypeToTs(t).tsType).toBe("string");
    }
  });

  it("maps boolean to boolean", () => {
    expect(pgTypeToTs("boolean").tsType).toBe("boolean");
    expect(pgTypeToTs("bool").tsType).toBe("boolean");
  });

  it("maps timestamp/date/time variants to string (ISO wire format, not Date)", () => {
    for (const t of ["timestamp", "timestamptz", "date", "time", "timetz"]) {
      expect(pgTypeToTs(t).tsType).toBe("string");
    }
  });

  it("maps json/jsonb to unknown", () => {
    expect(pgTypeToTs("jsonb").tsType).toBe("unknown");
  });

  it("maps bytea to string (base64 assumption)", () => {
    expect(pgTypeToTs("bytea").tsType).toBe("string");
  });

  it("falls back to unknown with isUnsupported for unrecognized types", () => {
    const info = pgTypeToTs("tsvector");
    expect(info.tsType).toBe("unknown");
    expect(info.isUnsupported).toBe(true);
  });
});

describe("tsTypeToPg", () => {
  it("maps known TS scalar keywords back to Postgres types", () => {
    expect(tsTypeToPg("string").pgType).toBe("text");
    expect(tsTypeToPg("number").pgType).toBe("numeric");
    expect(tsTypeToPg("boolean").pgType).toBe("boolean");
  });

  it("maps unknown to jsonb — pgTypeToTs's own marker for json/jsonb, not a generic fallback", () => {
    const result = tsTypeToPg("unknown");
    expect(result.pgType).toBe("jsonb");
    expect(result.isUnsupported).toBeUndefined();
  });

  it("falls back to text with isUnsupported for genuinely unrecognized types", () => {
    const result = tsTypeToPg("BigInt");
    expect(result.pgType).toBe("text");
    expect(result.isUnsupported).toBe(true);
  });
});

describe("pgTypeToGo", () => {
  it("maps integer variants", () => {
    expect(pgTypeToGo("integer").goType).toBe("int32");
    expect(pgTypeToGo("int4").goType).toBe("int32");
    expect(pgTypeToGo("bigint").goType).toBe("int64");
    expect(pgTypeToGo("int8").goType).toBe("int64");
    expect(pgTypeToGo("smallint").goType).toBe("int16");
    expect(pgTypeToGo("int2").goType).toBe("int16");
  });

  it("maps text/varchar/char/uuid to string", () => {
    expect(pgTypeToGo("text").goType).toBe("string");
    expect(pgTypeToGo("varchar(255)").goType).toBe("string");
    expect(pgTypeToGo("character varying(100)").goType).toBe("string");
    expect(pgTypeToGo("char(10)").goType).toBe("string");
    expect(pgTypeToGo("uuid").goType).toBe("string");
  });

  it("maps boolean to bool", () => {
    expect(pgTypeToGo("boolean").goType).toBe("bool");
    expect(pgTypeToGo("bool").goType).toBe("bool");
  });

  it("maps timestamp/date/time variants to time.Time and requires the time import", () => {
    for (const t of ["timestamp", "timestamptz", "timestamp with time zone", "date", "time", "timetz"]) {
      const info = pgTypeToGo(t);
      expect(info.goType).toBe("time.Time");
      expect(info.imports).toEqual(["time"]);
    }
  });

  it("maps numeric/decimal to string (avoids float precision loss / decimal dependency)", () => {
    expect(pgTypeToGo("numeric").goType).toBe("string");
    expect(pgTypeToGo("decimal(10,2)").goType).toBe("string");
  });

  it("maps real to float32 and double precision/float8 to float64", () => {
    expect(pgTypeToGo("real").goType).toBe("float32");
    expect(pgTypeToGo("float4").goType).toBe("float32");
    expect(pgTypeToGo("double precision").goType).toBe("float64");
    expect(pgTypeToGo("float8").goType).toBe("float64");
  });

  it("maps json/jsonb to json.RawMessage and requires the encoding/json import", () => {
    const info = pgTypeToGo("jsonb");
    expect(info.goType).toBe("json.RawMessage");
    expect(info.imports).toEqual(["encoding/json"]);
  });

  it("maps bytea to []byte", () => {
    expect(pgTypeToGo("bytea").goType).toBe("[]byte");
  });

  it("falls back to interface{} with isUnsupported for unknown types", () => {
    const info = pgTypeToGo("tsvector");
    expect(info.goType).toBe("interface{}");
    expect(info.isUnsupported).toBe(true);
  });

  it("falls back to interface{} for empty input", () => {
    const info = pgTypeToGo("");
    expect(info.goType).toBe("interface{}");
    expect(info.isUnsupported).toBe(true);
  });
});

describe("goTypeToPg", () => {
  it("maps known Go scalar types back to Postgres types", () => {
    expect(goTypeToPg("string").pgType).toBe("text");
    expect(goTypeToPg("int32").pgType).toBe("integer");
    expect(goTypeToPg("int").pgType).toBe("integer");
    expect(goTypeToPg("int64").pgType).toBe("bigint");
    expect(goTypeToPg("int16").pgType).toBe("smallint");
    expect(goTypeToPg("bool").pgType).toBe("boolean");
    expect(goTypeToPg("float64").pgType).toBe("double precision");
    expect(goTypeToPg("float32").pgType).toBe("real");
    expect(goTypeToPg("time.Time").pgType).toBe("timestamp");
    expect(goTypeToPg("[]byte").pgType).toBe("bytea");
    expect(goTypeToPg("json.RawMessage").pgType).toBe("jsonb");
  });

  it("strips a leading pointer marker before mapping", () => {
    expect(goTypeToPg("*string").pgType).toBe("text");
  });

  it("falls back to text with isUnsupported for unknown types", () => {
    const result = goTypeToPg("interface{}");
    expect(result.pgType).toBe("text");
    expect(result.isUnsupported).toBe(true);
  });
});

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
