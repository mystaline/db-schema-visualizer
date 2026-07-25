import type { Schema, SchemaTable, ForeignKey } from "../../src/types";

export const usersTable: SchemaTable = {
  id: "t_users",
  name: "users",
  columns: [
    { id: "c_users_id", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
    { id: "c_users_email", name: "email", type: "varchar(255)", isPrimaryKey: false, isNullable: false, isUnique: true, defaultValue: null },
    { id: "c_users_age", name: "age", type: "integer", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
    { id: "c_users_active", name: "is_active", type: "boolean", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: "true" },
    { id: "c_users_created", name: "created_at", type: "timestamptz", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
  ],
  indexes: [],
  checkConstraints: [],
};

export const postsTable: SchemaTable = {
  id: "t_posts",
  name: "posts",
  columns: [
    { id: "c_posts_id", name: "id", type: "uuid", isPrimaryKey: true, isNullable: false, isUnique: true, defaultValue: null },
    { id: "c_posts_author", name: "author_id", type: "uuid", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
    { id: "c_posts_title", name: "title", type: "text", isPrimaryKey: false, isNullable: false, isUnique: false, defaultValue: null },
    { id: "c_posts_views", name: "view_count", type: "bigint", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
    { id: "c_posts_price", name: "price", type: "numeric(10,2)", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
    { id: "c_posts_meta", name: "metadata", type: "jsonb", isPrimaryKey: false, isNullable: true, isUnique: false, defaultValue: null },
  ],
  indexes: [],
  checkConstraints: [],
};

export const sampleForeignKeys: ForeignKey[] = [
  {
    id: "fk_posts_author",
    sourceTableId: "t_posts",
    sourceColumnId: "c_posts_author",
    targetTableId: "t_users",
    targetColumnId: "c_users_id",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  },
];

export const sampleSchema: Schema = {
  tables: [usersTable, postsTable],
  foreignKeys: sampleForeignKeys,
};

/**
 * Fields that a schema -> generate -> parse round-trip is expected to drop
 * or normalize, for either the Go or TS codegen pair. Referenced by both the
 * round-trip tests and packages/core/README.md so the two can't drift.
 */
export const ROUNDTRIP_DROPPED_FIELDS = [
  "defaultValue",
  "isUnique (outside primary key)",
  "checkConstraints",
  "indexes",
  "foreignKeys",
  "exact Postgres type string (only the type category survives, e.g. varchar(255) -> text-ish)",
] as const;
