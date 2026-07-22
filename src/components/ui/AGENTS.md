# Purpose
Reusable, accessible UI primitives. Radix UI for complex interactions, CVA for variant styling.

# Ownership
Frontend developers / UI designers.

# Local Contracts
- Components MUST NOT contain complex business logic or data fetching.
- Styling via Tailwind CSS using `cn` utility for class merging.
- All variants defined with CVA (`class-variance-authority`).

# Work Guidance
- Use these as building blocks for all domain components.
- WCAG compliance: do not remove `aria-*` or `role` attributes.
- New primitives follow the same CVA + `cn` pattern as `button.tsx` and `badge.tsx`.

# Components
- `button.tsx` — Primary action button with variants (default/outline/ghost/destructive/secondary/link)
- `badge.tsx` — Status/role chip with semantic variants (success/warning/destructive/info/muted/owner/tenant + aliases paid/unpaid/pending/active/invited)
- `tooltip.tsx` — Hover tooltip (React state, no Radix dep). `TooltipIcon` for metric labels.
- `data-table.tsx` — Generic typed table with hover-reveal row actions, skeleton loading, empty state, right-aligned number columns.
- `dialog.tsx` — Modal dialog (Radix)
- `input.tsx`, `label.tsx`, `switch.tsx` — Form primitives (Radix)
- `toast.tsx`, `toaster.tsx` — Notification system (Radix)

# Child DOX Index
(None — leaf directory for UI primitives)

