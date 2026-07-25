# db-schema-visualizer

A browser-based PostgreSQL schema designer. Build entity-relationship diagrams visually, then export production-ready DDL — no backend, no account, no install.

![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## Features

- **Canvas** — pan, zoom, drag tables freely; FK relations drawn as SVG lines
- **Column editor** — name, type (full PostgreSQL type list), Primary Key (single-column), nullable, unique, default value; live identifier validation; drag-and-drop reorder
- **Foreign key editor** — outgoing and incoming references per table, ON DELETE/UPDATE actions; in-place editing of existing FKs
- **Index editor** — normal and unique indexes, composite columns, per-column ASC/DESC ordering, expression indexes, partial `WHERE` filter; auto-generated names
- **Inline rename** — double-click table name on canvas to rename
- **CHECK constraint editor** — free-form SQL expressions per table
- **SQL export** — generates `CREATE TABLE`, `ALTER TABLE ... ADD CONSTRAINT` (FKs), and `CREATE INDEX` in correct dependency order
- **URL sharing** — entire schema is gzip-compressed and base64-encoded into the URL hash; shareable as read-only or full-edit
- **localStorage** — auto-saves on every change; URL-first hydration with localStorage fallback
- **Keyboard shortcuts** — Delete key to remove selected table; Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo
- **Presets** — Blog (5 tables) and E-commerce (4 tables) starter schemas
- **Dark / light mode** — Raijin palette, dark-first

## Getting Started

```bash
pnpm install
pnpm dev
```

Build for production:

```bash
pnpm build
pnpm preview
```

## Tech Stack

| Layer     | Technology              |
| --------- | ----------------------- |
| Framework | Vue 3 (Composition API) |
| Language  | TypeScript 5            |
| Styling   | Tailwind CSS v4         |
| State     | Pinia                   |
| Build     | Vite 6                  |

## Workspace layout

This is a pnpm workspace. The web app lives at the repo root (unchanged);
the schema model, parsers, and codegen it uses are published as a
standalone package so they can power more than just the browser canvas:

| Package | Purpose |
| --- | --- |
| `packages/core` | Framework-agnostic schema model + parsers/codegen (SQL, Prisma, Drizzle, Mermaid, Go, TypeScript) — see [its README](packages/core/README.md) |
| `packages/mcp-server` | MCP server exposing `packages/core`'s capabilities as tools (schema↔Go, schema↔TS, SQL↔schema, JSON import, etc.) for AI agents — see [its README](packages/mcp-server/README.md) |
| `packages/vscode-extension` | Reserved for a future VSCode extension (webview embedding this app's canvas) — not yet implemented |

## Planned

- VSCode extension: a webview embedding this app's canvas with a schema
  pre-applied, driven by `packages/mcp-server` or an extension command
- Multi-project navigation with IndexedDB

## License

MIT — see [LICENSE](LICENSE)
---

**[→ mystaline.dev](https://mystaline.dev)** — full portfolio & project writeups

