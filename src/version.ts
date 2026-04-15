/**
 * APP VERSION — bump this string on every release.
 * The What's New modal fires automatically when a user's stored
 * version does not match this constant.
 */
export const APP_VERSION = "4.3.0";

/** localStorage key used to persist the last-seen version. */
export const VERSION_STORAGE_KEY = "schema_vis_version";

export interface ChangelogEntry {
  version: string;
  date: string;
  badge?: "new" | "improved" | "fix";
  items: {
    type: "feature" | "improvement" | "fix";
    text: string;
  }[];
}

/**
 * Full changelog, newest first.
 * Each entry maps 1-to-1 with a semver release derived from git history.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "4.3.0",
    date: "April 15, 2026",
    badge: "new",
    items: [
      {
        type: "feature",
        text: "Searchable PG Type Dropdown — quickly find the right column type with a new searchable input field on top of the types list.",
      },
      {
        type: "improvement",
        text: "Bulletproof SQL Import — the DDL parser now correctly handles IF NOT EXISTS, inline REFERENCES, backticks, and schema-qualified names.",
      },
      {
        type: "improvement",
        text: "Robust Relation Resolution — the importer now perfectly maps foreign keys even if the referenced table is defined later in the SQL file.",
      },
    ],
  },
  {
    version: "4.2.2",
    date: "April 15, 2026",
    badge: "improved",
    items: [
      {
        type: "improvement",
        text: "Added the Import Schema button to the desktop TopBar for easier access to SQL and JSON imports.",
      },
    ],
  },
  {
    version: "4.2.1",
    date: "April 15, 2026",
    badge: "fix",
    items: [
      {
        type: "fix",
        text: "Full overhaul of the light mode experience — improved contrast, refined borders, and better readability across all new modals.",
      },
      {
        type: "fix",
        text: "Standardized the color palette to strictly follow the Raijin design tokens for both light and dark themes.",
      },
    ],
  },
  {
    // (current session) — feat: JSON export & import
    version: "4.2.0",
    date: "April 15, 2026",
    badge: "new",
    items: [
      {
        type: "feature",
        text: "Export your schema as a JSON file — a complete backup you can reload later with everything intact.",
      },
      {
        type: "feature",
        text: "Import from JSON — restore a previously exported schema exactly as you left it.",
      },
      {
        type: "improvement",
        text: "Export and Import now let you choose between SQL and JSON with a tab at the top of the modal.",
      },
    ],
  },
  {
    // c6d556c — fix: name wrapping in constraint/index/FK editors
    version: "4.1.1",
    date: "April 14, 2026",
    badge: "fix",
    items: [
      {
        type: "fix",
        text: "Long constraint, index, and foreign key names no longer push the action buttons off-screen.",
      },
    ],
  },
  {
    // 83499fd — feat: SQL DDL import + dedicated parser
    version: "4.1.0",
    date: "April 11, 2026",
    badge: "new",
    items: [
      {
        type: "feature",
        text: "Import an existing SQL schema — paste CREATE TABLE statements or upload a .sql file to instantly visualise a database you already have.",
      },
      {
        type: "feature",
        text: "Drag and drop a .sql file directly onto the import area.",
      },
      {
        type: "feature",
        text: "A confirmation prompt appears before replacing your current workspace.",
      },
    ],
  },
  {
    // f1ace7e — feat: mobile overhaul
    version: "4.0.0",
    date: "April 11, 2026",
    badge: "new",
    items: [
      {
        type: "feature",
        text: "Full mobile support — all tools are accessible on phones and tablets via a slide-out menu.",
      },
      {
        type: "feature",
        text: "Touch gestures on the canvas — drag to pan, pinch to zoom, tap a table to select it.",
      },
      {
        type: "feature",
        text: "Tap a table on mobile to open a focused editor at the bottom of the screen.",
      },
    ],
  },
  {
    // 4797213 — backward compat for legacy index format
    version: "3.0.1",
    date: "April 9, 2026",
    badge: "fix",
    items: [
      {
        type: "fix",
        text: "Schemas saved in a previous session load correctly without losing any index definitions.",
      },
    ],
  },
  {
    // d26a100 — integrity + index overhaul
    version: "3.0.0",
    date: "April 9, 2026",
    badge: "improved",
    items: [
      {
        type: "improvement",
        text: "Index and constraint names update automatically when you rename a column or table.",
      },
      {
        type: "improvement",
        text: "Deleting a column removes any indexes and constraints that referenced it — no orphaned entries left behind.",
      },
      {
        type: "improvement",
        text: "Deleting a table removes all its foreign keys automatically, both outgoing and incoming.",
      },
      {
        type: "improvement",
        text: "Undo no longer reverts past the initial load — you can't accidentally undo your whole schema away.",
      },
      {
        type: "improvement",
        text: "Index editor redesigned — mix expression parts and column parts in the same index from one interface.",
      },
      {
        type: "fix",
        text: "Renaming a column no longer produces incorrect index names.",
      },
      {
        type: "fix",
        text: "Opening a read-only shared link no longer affects your own editable session.",
      },
    ],
  },
  {
    // fa5693a — fix(ui): hover indicators + section header styles
    version: "2.1.1",
    date: "April 9, 2026",
    badge: "fix",
    items: [
      {
        type: "fix",
        text: "The default-value indicator on a column row no longer disappears when you hover over it.",
      },
      {
        type: "fix",
        text: "Foreign key section headers are more consistent and visually distinct.",
      },
    ],
  },
  {
    // 23507c0 — inline FK editing, named constraints, undo/redo
    version: "2.1.0",
    date: "April 9, 2026",
    badge: "new",
    items: [
      {
        type: "feature",
        text: "Edit ON DELETE and ON UPDATE rules directly in the foreign key list — no need to open a separate form.",
      },
      {
        type: "feature",
        text: "CHECK constraints automatically get a descriptive name based on your table and expression.",
      },
      {
        type: "feature",
        text: "Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z) — works everywhere, safely skips when you're typing.",
      },
    ],
  },
  {
    // 3e38de6 — column defaults, expression indexes, reorder, keyboard delete
    version: "2.0.0",
    date: "April 7, 2026",
    badge: "new",
    items: [
      {
        type: "feature",
        text: "Set a default value for any column — a green indicator shows when one is active.",
      },
      {
        type: "feature",
        text: "Double-click a table name on the canvas to rename it in place.",
      },
      {
        type: "feature",
        text: "Add SQL expressions (e.g. lower(email)) as index parts alongside regular columns.",
      },
      {
        type: "feature",
        text: "Choose ASC or DESC order per column in a composite index.",
      },
      {
        type: "feature",
        text: "Drag the grip handle on any column row to reorder it.",
      },
      {
        type: "feature",
        text: "Press Delete with a table selected — a confirmation bar appears before anything is removed.",
      },
      {
        type: "improvement",
        text: "Sidebar buttons are always visible instead of appearing only on hover.",
      },
    ],
  },
  {
    // 591ce94 — persist schema to localStorage + URL hydration
    version: "1.1.0",
    date: "April 7, 2026",
    badge: "new",
    items: [
      {
        type: "feature",
        text: "Your schema saves automatically — refreshing the page brings everything back.",
      },
      {
        type: "feature",
        text: "Opening a shared link always loads that schema, even if you have a local session saved.",
      },
    ],
  },
  {
    // a91f1e8 — initial release
    version: "1.0.0",
    date: "April 7, 2026",
    items: [
      {
        type: "feature",
        text: "Design a PostgreSQL schema visually — add tables, columns, and relationships on a pannable, zoomable canvas.",
      },
      {
        type: "feature",
        text: "Drag tables anywhere; relationship lines follow automatically.",
      },
      {
        type: "feature",
        text: "Column editor — set type, primary key, nullable, and unique per column.",
      },
      {
        type: "feature",
        text: "Foreign key editor — define relationships with ON DELETE and ON UPDATE rules.",
      },
      {
        type: "feature",
        text: "Index editor — normal and unique indexes with multiple columns and an optional WHERE filter.",
      },
      {
        type: "feature",
        text: "CHECK constraint editor per table.",
      },
      {
        type: "feature",
        text: "Export your schema as a ready-to-run SQL file.",
      },
      {
        type: "feature",
        text: "Share your schema via a link — choose full edit access or read-only.",
      },
      {
        type: "feature",
        text: "Dark and light mode.",
      },
      {
        type: "feature",
        text: "Blog and E-Commerce starter templates to get going fast.",
      },
    ],
  },
];
