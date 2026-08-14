# Purpose

React components for displaying and interacting with individual bills.

# Ownership

Frontend developers.

# Local Contracts

- Must clearly present billing math for absolute transparency.
- Provide actions for tenants (Request Edit) and owners (Mark Paid).

# Work Guidance

- Use `apiClient` for data interactions.
- Ensure the layout is clean and printable.
- `BillActionBar` in `BillDetailSections.tsx` uses the Parameter Object Pattern: `OwnerEditContext` for owner reading-edit state, `TenantEditContext` for tenant edit-request state. Both are exported types. Pass `ownerEdit` and `tenantEdit` as optional props from `BillDetail.tsx`.

# Child DOX Index

(None)
