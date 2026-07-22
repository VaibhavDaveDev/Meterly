# Purpose
React components specific to the dashboard view.

# Ownership
Frontend developers.

# Local Contracts
- Components should be mobile-responsive and follow WCAG guidelines.
- Use shadcn/ui components for consistency.

# Work Guidance
- Use `apiClient` for data fetching.
- `ChartCard` interface supports fullscreen toggling, an 'All' range selection, a `defaultRange` prop, and includes an empty state guard to prevent Recharts warnings.
- `TOOLTIP_STYLE` and `CHART_COLORS` are the canonical chart style constants from `SharedUI.tsx`.
- `KpiCard` supports a `delta` prop for showing trend indicators.
- Brand chart color conventions: emerald (`#10b981`) = positive, amber (`#F59E0B`) = secondary, red (`#EF4444`) = negative.

# Child DOX Index
(None)
