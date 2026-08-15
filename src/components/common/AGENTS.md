# Purpose

Common, reusable React components (e.g., navigation, avatars).

# Ownership

Frontend developers.

# Local Contracts

- Components should be mobile-responsive and follow WCAG guidelines.
- Use shadcn/ui components for consistency where appropriate.

# Work Guidance

- `UserNav.tsx`: Handles user session display and logout functionality.
- `NotificationBell.tsx`: Bell icon in the dashboard header. Fetches the 4 most recent notifications on click, shows unread badge, mark-as-read per item or all-at-once. Links to `/notifications` for the full list.
- `NotificationHelpers.tsx`: Contains shared types (`Notification`), helpers (`timeAgo`, `iconColorClass`), and components (`NotificationIcon`) for notifications. Tested by `NotificationHelpers.test.tsx`.
- `TopLoader.tsx`: Custom top-loader component using Radix Progress primitive to show progress on active API calls.
- `LoadingStates.tsx`: Premium reusable state components (`SkeletonCard`, `ErrorCard`, `EmptyState`) for unified asynchronous content feedback.
- `AppErrorBoundary.tsx`: React class error boundary. Shows a friendly fallback UI on render errors instead of a blank crash screen. In dev mode, shows the full stack trace. In production, shows a minimal recovery message with a dashboard link.
- `withErrorBoundary.tsx`: Higher-order component that wraps any React component in `AppErrorBoundary`. Used at the export boundary of Astro `client:load` island components so each island has error containment.

# Work Guidance for Error Boundaries

- **Pattern:** Rename the internal function to `<ComponentName>Inner`, then export `const <ComponentName> = withErrorBoundary(<ComponentName>Inner)` at the module bottom.
- **Adoption:** `DashboardOverview`, `NotificationsPage`, `SettingsPage`, `TenantBillsPage` are wrapped. Apply this pattern to remaining page-level `client:load` islands as they are edited.
- **Do not** wrap sub-components (Badges, Inputs, etc.) — only top-level island components that are the sole React root on a page.

# Child DOX Index

(None)
