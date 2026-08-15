# Purpose

Custom React hooks for managing state and side effects.

# Ownership

Frontend developers.

# Local Contracts

- Hooks must follow React's rules of hooks.
- Hooks should be pure or manage encapsulated side effects.

# Work Guidance

- `use-async-resource.ts`: Generic data-fetching hook for reading data via `apiClient`. It centralizes `isLoading`, `error`, and data fetching. Use this for data fetching hooks.
- **Form/Mutation Hooks**: Hooks that contain form logic, validations, or mutations (e.g., submitting readings, resetting passwords) manage encapsulated client-side and network side effects and should NOT use `useAsyncResource`. Examples:
  - `use-forgot-password.ts`: Handles password reset state, Turnstile verification, and API calls.
  - `use-submit-reading.ts`: Manages meter reading submission form state, validations, calculations, and API calls.
  - `use-reading-validation.ts`, `use-reading-submit.ts`, `use-ocr-data.ts`: Contain form/mutation logic, not simple data-fetching.
- **Data-Fetching Hooks**: Hooks that wrap `useAsyncResource` for specific API endpoints.
  - `use-property-settings.ts`: Fetches property settings using `useAsyncResource`.
  - `use-bill-detail.ts`: Fetches bill details using `useAsyncResource`.

# Child DOX Index

(None)
