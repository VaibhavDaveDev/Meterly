# Purpose

Custom React hooks for managing state and side effects.

# Ownership

Frontend developers.

# Local Contracts

- Hooks must follow React's rules of hooks.
- Hooks should be pure or manage encapsulated side effects.

# Work Guidance

- **Data Fetching Pattern**: All client-side server-data fetching MUST use TanStack Query (`useQuery` / `useMutation` / `useInfiniteQuery`).
  - Query keys must come from `src/lib/query-keys.ts`.
  - Do not use raw `useEffect` + `useState` or bespoke generation counters for server data fetching.
- **Form/Mutation Hooks**: Hooks that contain multi-step form logic, client validations, or file processing manage encapsulated client-side state:
  - `use-forgot-password.ts`: Handles password reset state, Turnstile verification, and API calls.
  - `use-submit-reading.ts`: Manages meter reading submission form state, validations, calculations, and API calls.
  - `use-reading-validation.ts`, `use-reading-submit.ts`, `use-ocr-data.ts`: Contain form/mutation logic, progress states, and image processing.
  - `use-turnstile.ts`: Manages Turnstile widget lifecycle, rendering, reset, and unmount cleanup.
- **Data-Fetching Query Hooks**:
  - `use-dashboard-data.ts`: Fetches user profile, pending invites, and dashboard stats via `useQuery`.
  - `use-property-data.ts`: Fetches billing periods, tenancies, bills, and edit request counts via `useQuery`.
  - `use-bill-detail.ts`: Fetches bill details and provides mark-paid/edit-request mutations via TanStack Query.
  - `use-property-settings.ts`: Uses `useQuery` for active tenancies and unpaid bill counts.

# Child DOX Index

(None)
