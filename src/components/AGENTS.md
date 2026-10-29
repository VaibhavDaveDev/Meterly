# Components DOX

## Purpose

- Reusable React UI components and island roots organized by feature domain.

## Ownership

- `auth/` owns login, signup, verification, and password reset form components.
- `bills/` owns bill cards, split details, edit request dialogs, and bill history components.
- `common/` owns shared app-level components, including `withErrorBoundary`, `NotificationBell`, and `UserNav`.
- `dashboard/` owns overview metric cards, recent activity lists, and dashboard widget islands.
- `meter/` owns meter reading input forms, photo upload dropzones, and reading verification previews.
- `properties/` owns property creation, tenant management, rate configuration, and property card components.
- `settings/` owns user profile, password update, session management, and account deletion forms.
- `ui/` owns primitive design system components (buttons, dialogs, inputs, dropdowns, tables).

## Local Contracts

- Components must be strictly presentational or handle localized state only.
- Use Tailwind CSS for styling.
- **Island Boundary Rule:** Every React component mounted via `client:load` or `client:only` in an Astro page must export its entry wrapped with `withErrorBoundary(InnerComponent)`. This ensures `QueryClientProvider` and `AppErrorBoundary` are present at the island root.

## Child DOX Index

| Child                                          | Scope                                                        |
| ---------------------------------------------- | ------------------------------------------------------------ |
| [auth/AGENTS.md](./auth/AGENTS.md)             | Authentication forms and validation cards.                   |
| [bills/AGENTS.md](./bills/AGENTS.md)           | Bill breakdown, split tables, and action bars.               |
| [common/AGENTS.md](./common/AGENTS.md)         | Global headers, navigation, loaders, and error boundaries.   |
| [dashboard/AGENTS.md](./dashboard/AGENTS.md)   | Dashboard KPIs, overview charts, and notifications inbox.    |
| [meter/AGENTS.md](./meter/AGENTS.md)           | Meter reading inputs, photo uploads, and OCR previews.       |
| [properties/AGENTS.md](./properties/AGENTS.md) | Property details, tenant lists, and rate configuration tabs. |
| [settings/AGENTS.md](./settings/AGENTS.md)     | User settings, password update, and account lifecycle.       |
| [ui/AGENTS.md](./ui/AGENTS.md)                 | Accessible design system primitives (Radix UI + CVA).        |
