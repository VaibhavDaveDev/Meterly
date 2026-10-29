# Database Layer DOX

## Purpose

- Database schema, migrations, connection factory, and query abstractions using Drizzle ORM and Cloudflare D1.

## Ownership

- `index.ts` owns the D1 database client factory (`getDb`).
- `schema/` owns Drizzle table definitions, relations, and TypeScript models.
- `migrations/` owns SQL schema migrations and journal snapshots.
- `queries/` owns reusable complex database query functions and multi-table transactions.

## Local Contracts

- Use Drizzle ORM for schema definitions and queries.
- Cloudflare D1 enforces foreign-key constraints by default (equivalent to `PRAGMA foreign_keys = ON`). Application-level cascade ordering in route handlers is still required for tables whose FK definitions use `NO ACTION` or lack an `ON DELETE` clause.
- Never write raw SQL unless Drizzle cannot express the query.

## Work Guidance

- Add new tables in `schema/`, re-export in `schema/index.ts`, and run `pnpm db:generate`.

## Verification

```bash
pnpm test --run src/db
```

## Child DOX Index

- [queries/AGENTS.md](./queries/AGENTS.md): Reusable complex database query functions.
