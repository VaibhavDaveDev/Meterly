# Purpose
React components specific to property views (e.g., details, forms).

# Ownership
Frontend developers.

# Local Contracts
- Components should be mobile-responsive and follow WCAG guidelines.
- Use shadcn/ui components for consistency.

# Work Guidance
- Use `apiClient` for data fetching.
- Utilize `useToast` for user feedback instead of native alerts.
- `PropertyDetails.tsx`: Main orchestrator — contains all tabs (Overview, Tenants, Billing History, Rates, Charges, Settings).
- `PropertySettings.tsx`: Settings tab — solar toggle (with initial readings dialog), solo mode toggle, approval toggle.
- `SubmitReadingForm.tsx`: Delegation hook `useSubmitReading` encapsulates all form logic and live preview math. Presentational rendering is structured into `MeterDeltasTable` and `BillPreviewBreakdown` to keep cognitive complexity low. Accepts `startValues`, `rates`, and `splitPercentage` props for live preview. Always pass these from `PropertyDetails` which fetches them when the modal opens.
- `BillDetail` transparency: All calculations must show the source numbers and formula, per Plan.md Section 6.

# Child DOX Index
(None)
