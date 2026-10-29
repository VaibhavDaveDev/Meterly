# Database Queries DOX

## Purpose

- Reusable, complex database query functions and multi-step transactions.

## Ownership

- Query helper modules in this directory own reusable, cross-route Drizzle query builders and joins.

## Local Contracts

- Abstract complex joins and multi-step operations that do not belong directly in route handlers.
- Strongly typed return values matching schema definitions.

## Work Guidance

- Use Drizzle ORM query builder syntax.

## Verification

```bash
pnpm test --run src/db
```

## Child DOX Index

No child DOX files.
