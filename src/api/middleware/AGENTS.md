# Purpose
Hono middleware functions that intercept requests before they reach the route handlers.

# Ownership
API and Backend developers.

# Local Contracts
- Middleware must only mutate the Hono Context (`c.set()`) or return early HTTP responses (e.g., 401 Unauthorized).
- Do not place heavy business logic here.

# Work Guidance
- `auth.ts`: Responsible for extracting the session from headers via Better Auth and injecting the user object into the context.
- `turnstile.ts`: Implements Layer 1 of the three-layer defense model (Turnstile + Better Auth IP limit + OTP limiter) by blocking automated bots before auth logic runs.

# Child DOX Index
(None)
