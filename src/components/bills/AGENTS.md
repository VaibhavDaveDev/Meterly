# Bills Components DOX

## Purpose

- React components for displaying and interacting with individual bills, split calculations, and edit requests.

## Ownership

- `BillDetail.tsx` owns the main bill breakdown view, tenant/owner action triggers, and query coordination.
- `BillDetailPage.tsx` owns the client-side page container and route param extraction for individual bills.
- `BillDetailSections.tsx` owns modular bill display sections (breakdown metrics, reading diffs, calculation details, and `BillActionBar`).

## Local Contracts

- Must clearly present billing math for absolute transparency (source values, formula, final currency).
- Provide actions for tenants (Request Edit) and owners (Mark Paid).
- `BillActionBar` in `BillDetailSections.tsx` uses the Parameter Object Pattern: `OwnerEditContext` for owner reading-edit state, `TenantEditContext` for tenant edit-request state.

## Work Guidance

- Use TanStack Query hooks for all server-data fetching. Call `apiClient` only inside `queryFn` / `mutationFn` — never directly in component render or effects.
- Ensure layout is clean, responsive, and printable.

## Verification

```bash
pnpm test --run src/components/bills
```

## Child DOX Index

No child DOX files.
