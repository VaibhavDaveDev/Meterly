# UI Primitives DOX

## Purpose

- Reusable, accessible UI primitives built with Radix UI, CVA styling, and Tailwind CSS.

## Ownership

- `button.tsx` owns primary action button primitives and variants (`default`, `outline`, `ghost`, `destructive`, `secondary`, `link`).
- `badge.tsx` owns status and role chips with semantic variants.
- `dialog.tsx` owns accessible modal dialog overlays and containers (Radix Dialog).
- `tooltip.tsx` owns hover tooltip popovers and `TooltipIcon` helpers.
- `data-table.tsx` owns generic typed data tables with skeleton loading, empty states, and row actions.
- `input.tsx`, `label.tsx`, `switch.tsx`, `select.tsx`, `dropdown-menu.tsx`, `card.tsx`, `tabs.tsx` own form and layout primitives.
- `toast.tsx`, `toaster.tsx` own the app notification toast primitive.

## Local Contracts

- Components MUST NOT contain business logic or remote data fetching.
- Styling via Tailwind CSS using the `cn` utility for class merging.
- All variants defined with `class-variance-authority` (CVA).
- WCAG compliance: preserve all `aria-*` and `role` attributes.

## Work Guidance

- Follow the CVA + `cn` pattern when introducing new primitives.

## Verification

```bash
pnpm typecheck
```

## Child DOX Index

No child DOX files.
