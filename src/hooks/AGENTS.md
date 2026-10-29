# React Hooks DOX

## Purpose

- Custom React hooks for client state, form lifecycles, and TanStack Query server-data fetching.

## Ownership

- `use-dashboard-data.ts` owns overview metrics, property lists, and pending invite queries.
- `use-property-data.ts` owns billing period, tenancy, bill, and edit request queries for properties.
- `use-bill-detail.ts` owns bill breakdown data fetching and mark-paid / edit-request mutation hooks.
- `use-property-settings.ts` owns property setting queries and toggle mutations.
- `use-submit-reading.ts`, `use-reading-validation.ts`, `use-reading-submit.ts`, `use-ocr-data.ts` own meter reading submission form state, validations, and preview math.
- `use-forgot-password.ts` owns password reset form state and Turnstile validation.
- `use-turnstile.ts` owns Turnstile widget lifecycle (render, reset, cleanup).

## Local Contracts

- All client-side server-data fetching MUST use TanStack Query (`useQuery` / `useMutation` / `useInfiniteQuery`).
- Query keys must come from `src/lib/query-keys.ts`.
- Do not use raw `useEffect` + `useState` for server data fetching.

## Work Guidance

- Encapsulate complex form validation and state transitions in dedicated mutation hooks.

## Verification

```bash
pnpm test --run src/hooks
pnpm typecheck
```

## Child DOX Index

No child DOX files.
