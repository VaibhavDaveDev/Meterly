# Purpose
Hono API implementation for Meterly, including routes, middleware, and business logic.

# Ownership
API and Backend developers.

# Local Contracts
- Use Hono as the web framework.
- Define routes in `src/api/routes`.
- Implement shared logic in `src/api/lib`.
- **OpenAPI 3.0 via `@hono/zod-openapi`:** All routes must be registered via `router.openapi()` with Zod request/response schemas. Do not use standard `router.get/post/etc`.
- **Response Schemas:** Always use the standard `SuccessResponse` and `ErrorResponse` wrappers from `lib/openapi-schemas.ts`. Error responses must have a string `code` and `message`.

# Work Guidance
- Use Zod for input validation.
- Every route handler should be a named function.
- All calculation logic lives in `src/api/lib/billing-engine.ts`.

# Child DOX Index
- [lib](./lib/AGENTS.md): Core business logic, auth, and utilities.
- [routes](./routes/AGENTS.md): API route definitions.
- [middleware](./middleware/AGENTS.md): Hono middleware functions.
