export interface Column {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue: string | null;
}

export interface IndexPart {
  type: "column" | "expression";
  value: string; // columnId if type is 'column', raw expression string otherwise
  order?: "ASC" | "DESC"; // Usually for columns, but Postgres supports it for expressions too
}

export interface TableIndex {
  id: string;
  name: string;
  type: "normal" | "unique";
  parts: IndexPart[];
  filter?: string;
  // Legacy format support
  columnIds?: string[];
  expressions?: string[];
}

export interface CheckConstraint {
  id: string;
  name: string;
  expression: string;
}

/**
 * Semantic table shape — no canvas layout (x/y). Consumers that render a
 * visual canvas (e.g. the web app) extend this with their own layout fields.
 */
export interface SchemaTable {
  id: string;
  name: string;
  columns: Column[];
  indexes: TableIndex[];
  checkConstraints: CheckConstraint[];
  notes?: string;
}

export interface ForeignKey {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  onDelete: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  onUpdate: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}

export interface Schema {
  tables: SchemaTable[];
  foreignKeys: ForeignKey[];
}
