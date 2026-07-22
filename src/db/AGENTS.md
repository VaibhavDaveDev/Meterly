# Purpose
Database layer for Meterly, using Drizzle ORM and Cloudflare D1.

# Ownership
Database and Backend developers.

# Local Contracts
- Use Drizzle ORM for schema definition and queries.
- Schema files reside in `src/db/schema`.
- Query functions reside in `src/db/queries`.

# Work Guidance
- Never write raw SQL unless Drizzle can't express it.
- Use soft-delete patterns where history matters.

# Verification
- Validate migrations before deployment.

# Child DOX Index
- [queries](./queries/AGENTS.md): Reusable complex database queries.
