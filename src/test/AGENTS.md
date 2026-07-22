# Purpose
Test configuration and setup files for the application. Contains the in-memory SQLite setup for testing D1 operations and test utilities.

# Ownership
Quality Assurance and Backend Developers.

# Local Contracts
- Setup files must be used for all integration tests to ensure a consistent test environment.
- The `better-sqlite3` database mimics the production D1 environment.

# Work Guidance
- Tests should cover all edge cases, especially floating point math and zero-values in `billing-engine.ts`.
- Use shallow rendering tests for UI components with `@testing-library/react`.
- Cloudflare-specific modules (like `cloudflare:workers`) must be mocked in Vitest via `src/test/mocks/` (e.g. `cloudflare-workers.ts` mock).
- Note: `src/api/lib/auth-config.test.ts` was added for rate limit config smoke testing.

# Verification
- Run `pnpm test` to verify logic. Tests must pass locally.

# Child DOX Index
- None.
