# Common Components DOX

## Purpose

- Shared, reusable React components, layout helpers, error boundaries, and island providers.

## Ownership

- `UserNav.tsx` owns user session display, profile link, and sign-out action.
- `NotificationBell.tsx` owns the header notification bell trigger, popover unread feed, and mark-as-read actions.
- `NotificationHelpers.tsx` owns notification display formatting (`timeAgo`, `iconColorClass`) and icon rendering (`NotificationIcon`).
- `TopLoader.tsx` owns the global page progress bar during active network requests.
- `LoadingStates.tsx` owns unified asynchronous feedback primitives (`SkeletonCard`, `ErrorCard`, `EmptyState`).
- `AppErrorBoundary.tsx` owns React error containment and fallback UI rendering.
- `QueryProvider.tsx` owns TanStack Query singleton `QueryClientProvider` injection across Astro islands.
- `withErrorBoundary.tsx` owns the HOC uniting `QueryProvider` and `AppErrorBoundary` for island exports.

## Local Contracts

- Mobile-responsive and WCAG accessible.
- Top-level `client:load` or `client:only` island exports must be wrapped with `withErrorBoundary`. Do not wrap internal sub-components.

## Work Guidance

- Export pattern: rename inner function to `<ComponentName>Inner`, export `const <ComponentName> = withErrorBoundary(<ComponentName>Inner)`.

## Verification

```bash
pnpm test --run src/components/common
```

## Child DOX Index

No child DOX files.
