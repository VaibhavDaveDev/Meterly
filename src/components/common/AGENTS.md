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

# Child DOX Index
(None)
