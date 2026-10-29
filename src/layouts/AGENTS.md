# Layouts DOX

## Purpose

- Astro layouts and common page structures.
- Provide reusable layout components with consistent branding, navigation, and styling.

## Ownership

- `DashboardLayout.astro` owns the authenticated app shell, top navigation bar, sticky header, `NotificationBell`, and `UserNav` mounting.
- `AuthLayout.astro` owns public authentication page shells (`login`, `signup`, `verify-email`, `forgot-password`), branding sidebar, and client-side Turnstile script injection.

## Local Contracts

- Define Astro layouts to wrap pages.
- Handle common `<head>` elements, navigation, and footers here.
- TypeScript `Props` interface is mandatory for layout configuration.
- Turnstile is loaded in `AuthLayout` for bot protection; site key is injected from `PUBLIC_TURNSTILE_SITE_KEY` (undefined in dev skips validation).

## Work Guidance

- Responsive design: branding sidebar is hidden on mobile, visible on desktop (`lg` breakpoint).
- Dark mode support via CSS variables and Tailwind `dark:` prefix.

## Verification

```bash
pnpm typecheck   # validate Astro component types
```

## Child DOX Index

No child DOX files.
