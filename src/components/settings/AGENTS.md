# Settings Components DOX

## Purpose

- User account settings, profile customization, password changes, and account lifecycle management.

## Ownership

- `SettingsPage.tsx` owns user profile editing (name, avatar), password update forms, session management, and account deletion controls.

## Local Contracts

- Fetch user data from Better Auth session.
- Account deletion requires zero owned active properties before proceeding.

## Work Guidance

- Follow Meterly design system (no gradients, minimal aesthetic, Work Sans body, Manrope headings).

## Verification

```bash
pnpm test --run src/components/settings
```

## Child DOX Index

No child DOX files.
