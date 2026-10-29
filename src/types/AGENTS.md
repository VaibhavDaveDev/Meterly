# Type Definitions DOX

## Purpose

- Global TypeScript type definitions, domain models, and database interface declarations.

## Ownership

- `db.ts` owns database inferred types and domain entity models derived from the Drizzle schema.
- Global declarations in this directory own cross-cutting types shared between frontend and backend.

## Local Contracts

- Prefer `type` or `interface` over classes.
- No `any` types — define explicit strict types.

## Work Guidance

- Place domain-specific component prop types in their component directories; place shared data contract types here.

## Verification

```bash
pnpm typecheck
```

## Child DOX Index

No child DOX files.
