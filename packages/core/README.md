# @schemaviz/core

Framework-agnostic schema model, parsers, and codegen shared by the SchemaViz
web app and [`@schemaviz/mcp-server`](../mcp-server). Pure functions only —
no DOM, no Vue, no framework coupling.

## Public API

Two entry points:

- **`@schemaviz/core`** — the main barrel. Safe for browser bundling (no
  heavy dependencies).
- **`@schemaviz/core/ts`** — the full TS codegen toolkit, including the
  reverse parser (`parseTsInterfaces`), which uses the TypeScript Compiler
  API — a multi-MB dependency. Kept out of the main barrel so consumers that
  bundle for the browser (the web app) never pull it in just by importing
  `@schemaviz/core`.

### Types

`Schema`, `SchemaTable` (no `x`/`y` — layout-free; the web app's `Table`
extends this with canvas position), `Column`, `IndexPart`, `TableIndex`,
`CheckConstraint`, `ForeignKey`.

### SQL

- `parseDDL(sql)` — Postgres DDL → `{ tables, foreignKeys }`.
- `buildSchemaSql(tables, foreignKeys, opts)` / `buildTableSql(...)` — schema → DDL.
- `hasBrokenRefs`, `countCrossBoundaryFks` — schema integrity helpers.

### Codegen (schema → target)

`buildPrismaSchema`, `buildDrizzleSchema`, `buildMermaidEr`, `buildGoStructs`,
`buildTsInterfaces` (from `@schemaviz/core/ts` or the main barrel — see above).

### Reverse parsers (target → schema)

`parseGoStructs` (main barrel), `parseTsInterfaces` (`@schemaviz/core/ts`
only). Both return `{ tables, foreignKeys: [], warnings }` — **foreignKeys is
always empty**, since neither Go struct tags nor TS interfaces have a native
FK concept.

### Shared utilities

`normalizeImportedTable` / `migrateLegacyIndexes` — normalizes an imported
table (fills missing `checkConstraints`, migrates the legacy
`TableIndex.columnIds`/`expressions` shape into `parts`). Shared by the web
app's local-storage/URL-share/JSON-import paths and the MCP server's
`create_schema_from_json` tool, so the migration logic lives in exactly one
place.

## Type mapping tables

### Postgres → Go (`pgTypeToGo`)

| Postgres | Go |
|---|---|
| `integer`, `int4` | `int32` |
| `bigint`, `int8` | `int64` |
| `smallint`, `int2` | `int16` |
| `text`, `varchar`, `char`, `uuid` | `string` |
| `boolean`, `bool` | `bool` |
| `timestamp*`, `date`, `time*` | `time.Time` |
| `numeric`, `decimal` | `string` *(avoids float precision loss / decimal library dependency)* |
| `real`, `float4` | `float32` |
| `double precision`, `float8` | `float64` |
| `json`, `jsonb` | `json.RawMessage` |
| `bytea` | `[]byte` |
| unrecognized | `interface{}` *(+ warning)* |

Nullable non-PK columns are wrapped in a pointer (`*T`) by default
(`pointerForNullable: true`).

### Postgres → TS (`pgTypeToTs`)

| Postgres | TS |
|---|---|
| integer/bigint/smallint/numeric/decimal/real/float family | `number` *(no int/bigint/float distinction — documented precision caveat)* |
| `text`, `varchar`, `char`, `uuid` | `string` |
| `boolean`, `bool` | `boolean` |
| `timestamp*`, `date`, `time*` | `string` *(ISO wire format — this targets API/wire-facing interfaces, not driver types, so it's `string` not `Date`)* |
| `json`, `jsonb` | `unknown` |
| `bytea` | `string` *(base64 assumption)* |
| unrecognized | `unknown` *(+ warning)* |

Nullable non-PK columns become `field?: T \| null` by default
(`optionalForNullable: true`).

## Round-trip limitations

`schema → Go/TS → schema` is **lossy by design** — this is a documented
contract, not a bug. What's dropped or normalized on every round trip
(see `__tests__/fixtures/sampleSchema.ts`'s `ROUNDTRIP_DROPPED_FIELDS`,
referenced by the round-trip tests so this list and the tests can't drift):

- `defaultValue`
- `isUnique` outside the primary key
- `checkConstraints`
- `indexes`
- `foreignKeys` (always empty after any reverse parse)
- the exact Postgres type string — only the *type category* survives (e.g.
  `varchar(255)` → Go `string` → back to `text`)

What **does** round-trip exactly (for the default generator options):
table names, column names, primary-key flags, nullability, and any type
whose Go/TS representation is unambiguous in both directions (`integer`,
`bigint`, `boolean`, `jsonb`).

### Other documented parser limitations

**Go struct source (`parseGoStructs`)**: no support for embedded/anonymous
structs, non-`json`/`db` tags (e.g. `gorm:"..."`, ignored), pointer-to-struct
or slice-of-struct fields (no nested table extraction — each is skipped with
a warning), or methods/interfaces (only `type X struct {}` blocks are
scanned).

**TS interface source (`parseTsInterfaces`)**: no support for generics,
mapped/intersection types, `extends` chains (only the interface's own
members are read), method/call/index signatures, nested object type
literals, or enum-like string-literal unions — each falls back to a safe
default type (`text`/`unknown`) plus a warning, never a crash.

## Testing

`pnpm --filter @schemaviz/core test` runs the full suite (Vitest, Node
environment). Includes unit tests per Postgres-type mapping row, per
documented parser limitation, and round-trip tests
(`__tests__/roundtrip/schema-go-schema.spec.ts`,
`schema-ts-schema.spec.ts`) that assert exactly what survives a round trip
and what doesn't.
