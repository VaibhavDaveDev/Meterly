# Auth Components DOX

## Purpose

- React island components for authentication flows: login, signup, email verification, and password reset.

## Ownership

- `LoginForm.tsx` owns email+password sign-in, Google/GitHub OAuth, and unverified error redirection to `/verify-email?reason=login`.
- `SignupForm.tsx` owns account registration, password strength metering, and redirect to `/verify-email`.
- `VerifyEmailForm.tsx` owns 6-digit OTP entry, verification context banner (`reason=login`), and resend OTP button with client-side cooldown countdown.
- `ForgotPasswordForm.tsx` owns email OTP-based password reset submission.
- `AuthFormLayout.tsx` owns the shared auth card layout, social buttons, inline feedback messages, and footer links.
- `AuthInputs.tsx` owns styled authentication input primitives (`EmailInput`, `PasswordInput`, `TextInput`).

## Local Contracts

- Page-mounted auth form islands (`LoginForm`, `SignupForm`, `VerifyEmailForm`, `ForgotPasswordForm`) must export wrapped with `withErrorBoundary(InnerComponent)`. Internal subcomponents (`AuthFormLayout`, `AuthInputs`) are not Astro islands and must NOT be wrapped with `withErrorBoundary` to prevent redundant nested providers.
- Use `authClient` (from `../../lib/auth-client`) for all Better Auth actions — never call API routes directly.
- Feedback is rendered inline via `message` / `isError` props passed to `AuthFormLayout` — not via toast.
- Mobile-responsive; dark-mode via CSS variables.

## Work Guidance

- Preserve error redirection on unverified credentials so unverified users are routed directly to verification.
- Ensure the resend button enforces client-side countdown before allowing another request.

## Verification

```bash
pnpm test --run src/components/auth
pnpm typecheck
```

## Child DOX Index

No child DOX files.
