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
