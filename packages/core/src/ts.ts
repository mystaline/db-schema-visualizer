// Full TS codegen toolkit, including the reverse parser (uses the
// TypeScript Compiler API — a multi-MB dependency). Import from
// "@schemaviz/core/ts" rather than the main "@schemaviz/core" barrel so
// browser bundles that only need forward codegen (or nothing TS-related at
// all) never pull the compiler in.
export { buildTsInterfaces } from "./generators/ts/tsGenerator";
export type { TsGeneratorOptions, TsGenerateResult } from "./generators/ts/tsGenerator";
export { parseTsInterfaces } from "./parsers/ts/tsToSchema";
export type { TsParseResult } from "./parsers/ts/tsToSchema";
export { pgTypeToTs, tsTypeToPg } from "./generators/shared/pgTypeMap";
export type { TsTypeInfo, TsToPgResult } from "./generators/shared/pgTypeMap";
