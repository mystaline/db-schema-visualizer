# db-schema-visualizer

A browser-based PostgreSQL schema designer. Build entity-relationship diagrams visually, then export production-ready DDL — no backend, no account, no install.

![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## Features

- **Canvas** — pan, zoom, drag tables freely; FK relations drawn as SVG lines
- **Column editor** — name, type (full PostgreSQL type list), PK, nullable, unique flags; live identifier validation
- **Foreign key editor** — outgoing and incoming references per table, ON DELETE/UPDATE actions
- **Index editor** — normal and unique indexes, composite columns, partial `WHERE` filter; auto-generated names
- **CHECK constraint editor** — free-form SQL expressions per table
- **SQL export** — generates `CREATE TABLE`, `ALTER TABLE ... ADD CONSTRAINT` (FKs), and `CREATE INDEX` in correct dependency order
- **URL sharing** — entire schema is gzip-compressed and base64-encoded into the URL hash; shareable as read-only or full-edit
- **Presets** — Blog and E-commerce starter schemas
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

| Layer | Technology |
| --- | --- |
| Framework | Vue 3 (Composition API) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| State | Pinia |
| Build | Vite 6 |

## Planned

- Column default values
- Table rename and notes
- Named CHECK constraints in SQL export (`CONSTRAINT chk_<table>_<n> CHECK (...)`)
- Composite primary key support
- FK edit (currently delete + recreate)
- Undo / redo

## License

MIT — see [LICENSE](LICENSE)
