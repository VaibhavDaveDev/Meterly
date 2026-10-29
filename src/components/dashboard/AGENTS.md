# Dashboard Components DOX

## Purpose

- React components specific to the dashboard view, metrics visualization, and notification center.

## Ownership

- `Overview.tsx` owns the dashboard overview island router, switching between owner and tenant views.
- `OwnerDashboard.tsx` owns property metric KPIs, occupancy stats, property list summaries, and consumption trends.
- `TenantDashboard.tsx` owns tenant active lease cards, current reading status, unbilled unit usage, and recent bills.
- `NotificationsPage.tsx` owns the full-page notification inbox, filtering, and bulk read actions.
- `SharedUI.tsx` owns dashboard display primitives (`ChartCard`, `KpiCard`, chart style constants, empty states).
- `types.ts` owns dashboard view model definitions and prop interfaces.

## Local Contracts

- Components must be mobile-responsive and follow WCAG guidelines.
- `ChartCard` must include an explicit wrapper div with `min-h-[Npx]` and `w-full` to prevent Recharts zero-dimension errors.
- Chart color constants (`TOOLTIP_STYLE`, `CHART_COLORS`) from `SharedUI.tsx` must be used for consistency.

## Work Guidance

- Brand chart color conventions: emerald (`#10b981`) = positive, amber (`#F59E0B`) = secondary, red (`#EF4444`) = negative.

## Verification

```bash
pnpm test --run src/components/dashboard
```

## Child DOX Index

No child DOX files.
