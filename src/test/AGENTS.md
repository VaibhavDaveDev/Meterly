# Test Utilities DOX

## Purpose

- Shared test configuration, setup files, in-memory SQLite database, and mock providers for Vitest.

## Ownership

- `setup.ts` owns global Vitest environment setup, in-memory SQLite database lifecycle, canvas/DOM polyfills, and D1 simulation (`PRAGMA foreign_keys = OFF`).
- `mocks/` owns environment and external module mocks (such as `cloudflare:workers`).

## Local Contracts

- `src/test/setup.ts` sets `PRAGMA foreign_keys = OFF` deliberately so fixtures can be torn down in any order without FK constraint errors. This is an intentional divergence from production D1, which enforces FK constraints by default. Do NOT remove this pragma — removing it would cause FK errors during test teardown.
- External Cloudflare bindings must be mocked through `src/test/mocks/`.

## Work Guidance

- Keep mock implementations lightweight and isolated.

## Verification

```bash
pnpm test --run
```

## Child DOX Index

No child DOX files.
