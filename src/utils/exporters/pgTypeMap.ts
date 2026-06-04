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
