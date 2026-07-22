# Purpose
Astro layouts and common page structures. Provides reusable layout components with consistent branding, navigation, and styling.

# Ownership
Frontend developers.

# Local Contracts
- Define Astro layouts to wrap pages
- Handle common `<head>` elements, navigation, and footers here
- **DashboardLayout.astro**: Wraps authenticated dashboard pages with sticky header navigation (horizontal layout with logo, Overview/Notifications links, NotificationBell, and UserNav dropdown)
- **AuthLayout.astro**: Wraps authentication pages (login, signup, forgot-password) with animated branding sidebar

# Work Guidance
- Use TypeScript Props interfaces for layout configuration
- Include Turnstile script loading in AuthLayout for bot protection
- Responsive design: branding sidebar hidden on mobile, shown on desktop (lg breakpoint)
- Dark mode support via CSS variables and Tailwind's dark: prefix

# Verification
- Run `pnpm run typecheck` to validate Astro component types
- Test layouts on mobile and desktop viewports

# Child DOX Index
(None)
