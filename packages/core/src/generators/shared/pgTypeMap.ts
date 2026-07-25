const exact: Record<string, string> = {
  integer: "int",
  int: "int",
  int4: "int",
  bigint: "bigint",
  int8: "bigint",
  smallint: "smallint",
  int2: "smallint",
  text: "varchar",
  "character varying": "varchar",
  char: "char",
  character: "char",
  boolean: "boolean",
  bool: "boolean",
  timestamp: "timestamp",
  "timestamp without time zone": "timestamp",
  timestamptz: "timestamp",
  "timestamp with time zone": "timestamp",
  date: "date",
  time: "time",
  timetz: "time",
  "time with time zone": "time",
  uuid: "uuid",
  json: "json",
  jsonb: "json",
  numeric: "decimal",
  decimal: "decimal",
  float: "float",
  float4: "float",
  float8: "float",
  real: "float",
  "double precision": "float",
  bytea: "bytes",
};

export interface PrismaTypeInfo {
  scalar: string;
  nativeType?: string;
  isSerial?: boolean;
  isUnsupported?: boolean;
}

export function pgTypeToPrisma(pgType: string): PrismaTypeInfo {
  if (!pgType || !pgType.trim()) return { scalar: 'Unsupported("")', isUnsupported: true };

  const raw = pgType.trim().toLowerCase();
  const base = raw.replace(/\(.*\)/s, "").trim();
  const lenMatch = raw.match(/\((\d+)\)/);
  const psMatch = raw.match(/\((\d+)\s*(?:,\s*(\d+))?\)/);
  const length = lenMatch ? parseInt(lenMatch[1]) : undefined;
  const precision = psMatch ? parseInt(psMatch[1]) : undefined;
  const scale = psMatch && psMatch[2] ? parseInt(psMatch[2]) : undefined;

  if (["integer", "int", "int4"].includes(base)) return { scalar: "Int" };
  if (["smallint", "int2"].includes(base)) return { scalar: "Int", nativeType: "@db.SmallInt" };
  if (["bigint", "int8"].includes(base)) return { scalar: "BigInt" };
  if (["serial"].includes(base)) return { scalar: "Int", isSerial: true };
  if (["bigserial"].includes(base)) return { scalar: "BigInt", isSerial: true };
  if (["text"].includes(base)) return { scalar: "String" };
  if (["varchar", "character varying"].includes(base))
    return length ? { scalar: "String", nativeType: `@db.VarChar(${length})` } : { scalar: "String" };
  if (["char", "character"].includes(base))
    return length ? { scalar: "String", nativeType: `@db.Char(${length})` } : { scalar: "String", nativeType: "@db.Char(1)" };
  if (["boolean", "bool"].includes(base)) return { scalar: "Boolean" };
  if (["uuid"].includes(base)) return { scalar: "String", nativeType: "@db.Uuid" };
  if (["timestamp", "timestamp without time zone"].includes(base)) return { scalar: "DateTime", nativeType: "@db.Timestamp(6)" };
  if (["timestamptz", "timestamp with time zone"].includes(base)) return { scalar: "DateTime", nativeType: "@db.Timestamptz(6)" };
  if (["date"].includes(base)) return { scalar: "DateTime", nativeType: "@db.Date" };
  if (["time", "time without time zone"].includes(base)) return { scalar: "DateTime", nativeType: "@db.Time(6)" };
  if (["timetz", "time with time zone"].includes(base)) return { scalar: "DateTime", nativeType: "@db.Timetz(6)" };
  if (["json", "jsonb"].includes(base)) return { scalar: "Json" };
  if (["numeric", "decimal"].includes(base)) {
    if (precision !== undefined && scale !== undefined) return { scalar: "Decimal", nativeType: `@db.Decimal(${precision}, ${scale})` };
    if (precision !== undefined) return { scalar: "Decimal", nativeType: `@db.Decimal(${precision})` };
    return { scalar: "Decimal" };
  }
  if (["real", "float4"].includes(base)) return { scalar: "Float", nativeType: "@db.Real" };
  if (["double precision", "float8", "float"].includes(base)) return { scalar: "Float" };
  if (["bytea"].includes(base)) return { scalar: "Bytes" };

  return { scalar: `Unsupported("${pgType.trim()}")`, isUnsupported: true };
}

export interface GoTypeInfo {
  goType: string;
  imports: string[];
  isUnsupported?: boolean;
}

/**
 * Maps a Postgres type to a Go type. numeric/decimal deliberately map to
 * `string` rather than a float (precision loss) or a decimal library
 * (external dependency) — this is a documented, warning-producing choice,
 * not an oversight.
 */
export function pgTypeToGo(pgType: string): GoTypeInfo {
  if (!pgType || !pgType.trim()) return { goType: "interface{}", imports: [], isUnsupported: true };

  const raw = pgType.trim().toLowerCase();
  const base = raw.replace(/\(.*\)/s, "").trim();

  if (["integer", "int", "int4"].includes(base)) return { goType: "int32", imports: [] };
  if (["bigint", "int8"].includes(base)) return { goType: "int64", imports: [] };
  if (["smallint", "int2"].includes(base)) return { goType: "int16", imports: [] };
  if (["text", "varchar", "character varying", "char", "character", "uuid"].includes(base))
    return { goType: "string", imports: [] };
  if (["boolean", "bool"].includes(base)) return { goType: "bool", imports: [] };
  if (
    [
      "timestamp",
      "timestamp without time zone",
      "timestamptz",
      "timestamp with time zone",
      "date",
      "time",
      "time without time zone",
      "timetz",
      "time with time zone",
    ].includes(base)
  )
    return { goType: "time.Time", imports: ["time"] };
  if (["numeric", "decimal"].includes(base)) return { goType: "string", imports: [] };
  if (["real", "float4"].includes(base)) return { goType: "float32", imports: [] };
  if (["double precision", "float8", "float"].includes(base)) return { goType: "float64", imports: [] };
  if (["json", "jsonb"].includes(base)) return { goType: "json.RawMessage", imports: ["encoding/json"] };
  if (["bytea"].includes(base)) return { goType: "[]byte", imports: [] };

  return { goType: "interface{}", imports: [], isUnsupported: true };
}

export interface GoToPgResult {
  pgType: string;
  isUnsupported?: boolean;
}

/** Reverse of pgTypeToGo — best-effort, used by the Go struct source parser. */
export function goTypeToPg(goType: string): GoToPgResult {
  const base = goType.trim().replace(/^\*/, "");

  switch (base) {
    case "string":
      return { pgType: "text" };
    case "int":
    case "int32":
      return { pgType: "integer" };
    case "int64":
      return { pgType: "bigint" };
    case "int16":
      return { pgType: "smallint" };
    case "bool":
      return { pgType: "boolean" };
    case "float64":
      return { pgType: "double precision" };
    case "float32":
      return { pgType: "real" };
    case "time.Time":
      return { pgType: "timestamp" };
    case "[]byte":
      return { pgType: "bytea" };
    case "json.RawMessage":
      return { pgType: "jsonb" };
    default:
      return { pgType: "text", isUnsupported: true };
  }
}

export interface TsTypeInfo {
  tsType: string;
  isUnsupported?: boolean;
}

/**
 * Maps a Postgres type to a TS type for API/wire-facing interfaces (not
 * driver-level types). Dates map to `string` (ISO), not `Date`, since this
 * targets JSON-safe consumer interfaces. bigint/numeric map to `number`,
 * which is a documented, warning-producing precision caveat, not an
 * oversight — a dedicated bigint/decimal option can be added later.
 */
export function pgTypeToTs(pgType: string): TsTypeInfo {
  if (!pgType || !pgType.trim()) return { tsType: "unknown", isUnsupported: true };

  const raw = pgType.trim().toLowerCase();
  const base = raw.replace(/\(.*\)/s, "").trim();

  if (
    [
      "integer",
      "int",
      "int4",
      "bigint",
      "int8",
      "smallint",
      "int2",
      "numeric",
      "decimal",
      "real",
      "float4",
      "double precision",
      "float8",
      "float",
    ].includes(base)
  )
    return { tsType: "number" };
  if (["text", "varchar", "character varying", "char", "character", "uuid"].includes(base))
    return { tsType: "string" };
  if (["boolean", "bool"].includes(base)) return { tsType: "boolean" };
  if (
    [
      "timestamp",
      "timestamp without time zone",
      "timestamptz",
      "timestamp with time zone",
      "date",
      "time",
      "time without time zone",
      "timetz",
      "time with time zone",
    ].includes(base)
  )
    return { tsType: "string" };
  if (["json", "jsonb"].includes(base)) return { tsType: "unknown" };
  if (["bytea"].includes(base)) return { tsType: "string" };

  return { tsType: "unknown", isUnsupported: true };
}

export interface TsToPgResult {
  pgType: string;
  isUnsupported?: boolean;
}

/** Reverse of pgTypeToTs — best-effort, used by the TS interface source parser. */
export function tsTypeToPg(tsType: string): TsToPgResult {
  switch (tsType) {
    case "string":
      return { pgType: "text" };
    case "number":
      return { pgType: "numeric" };
    case "boolean":
      return { pgType: "boolean" };
    case "unknown":
      // pgTypeToTs's own marker for json/jsonb — treat as a non-lossy round-trip,
      // not a generic unsupported fallback.
      return { pgType: "jsonb" };
    default:
      return { pgType: "text", isUnsupported: true };
  }
}

export function pgTypeToMermaid(pgType: string): string {
  if (!pgType || !pgType.trim()) return "unknown";
  const stripped = pgType.replace(/\(.*\)/, "").trim().toLowerCase();
  if (stripped in exact) return exact[stripped];
  if (stripped.startsWith("varchar") || stripped.startsWith("character varying")) return "varchar";
  if (stripped.startsWith("char") || stripped.startsWith("character")) return "char";
  if (stripped.startsWith("numeric") || stripped.startsWith("decimal")) return "decimal";
  if (stripped.startsWith("timestamp")) return "timestamp";
  if (stripped.startsWith("time")) return "time";
  return stripped.replace(/\s+/g, "_");
}
