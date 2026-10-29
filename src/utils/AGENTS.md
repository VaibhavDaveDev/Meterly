# Utilities DOX

## Purpose

- Pure, stateless helper functions shared across the application.

## Ownership

- Modules in this directory own stateless shared utility functions (date parsing, string manipulation, formatting).

## Local Contracts

- Functions must be pure, stateless, and free of side effects.
- No direct database or network dependencies.

## Work Guidance

- If a helper needs network access or React state, place it in `src/lib/` or `src/hooks/`.

## Verification

```bash
pnpm test --run src/utils
```

## Child DOX Index

No child DOX files.
